/**
 * Cliente da API Notion (só no service worker).
 * Version 2026-03-11: databases viraram data sources.
 */
(function (root) {
  const API = "https://api.notion.com/v1";
  const VERSION = "2022-06-28";
  const Schema = () => root.SeiNotionSchema;

  const MAX_INFLIGHT = 3;
  let inflight = 0;
  const waiters = [];
  const dsCache = new Map();
  const templateCache = new Map();
  let usersCache = null;
  const DS_TTL = 5 * 60 * 1000;
  const USERS_TTL = 10 * 60 * 1000;
  const TPL_TTL = 5 * 60 * 1000;

  function acquireSlot() {
    if (inflight < MAX_INFLIGHT) {
      inflight += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      waiters.push(resolve);
    });
  }

  function releaseSlot() {
    const next = waiters.shift();
    if (next) {
      next();
      return;
    }
    inflight = Math.max(0, inflight - 1);
  }

  function cacheGet(map, key, ttl) {
    const hit = map.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.value;
    return null;
  }

  function cacheSet(map, key, value) {
    map.set(key, { at: Date.now(), value });
    return value;
  }

  function invalidateSchemaCache(id) {
    if (id) dsCache.delete(id);
    else dsCache.clear();
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function notionFetch(token, path, opts) {
    const method = (opts && opts.method) || "GET";
    const body = opts && opts.body;
    const url = path.startsWith("http") ? path : API + path;

    await acquireSlot();
    try {
      let attempt = 0;
      while (attempt < 4) {
        const res = await fetch(url, {
          method,
          headers: {
            Authorization: "Bearer " + token,
            "Notion-Version": VERSION,
            "Content-Type": "application/json"
          },
          body: body ? JSON.stringify(body) : undefined
        });

        if (res.status === 429) {
          const wait = Number(res.headers.get("Retry-After") || 1) * 1000;
          await sleep(Math.min(8000, wait * (attempt + 1)));
          attempt += 1;
          continue;
        }

        let json = null;
        const text = await res.text();
        if (text) {
          try {
            json = JSON.parse(text);
          } catch (_) {
            json = { message: text };
          }
        }

        if (!res.ok) {
          const msg =
            (json && (json.message || json.error)) ||
            "HTTP " + res.status;
          const err = new Error(msg);
          err.status = res.status;
          err.code = json && json.code;
          throw err;
        }
        return json;
      }
      throw new Error("Notion recusou a requisição (limite de taxa). Tente de novo.");
    } finally {
      releaseSlot();
    }
  }

  function richPlain(items) {
    return (items || []).map((t) => t.plain_text || "").join("");
  }

  function parseNotionId(input) {
    const raw = String(input || "").trim();
    if (!raw) return null;
    const dashed = raw.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    if (dashed) return dashed[0].toLowerCase();
    const hex = raw.match(/([0-9a-f]{32})/i);
    if (!hex) return null;
    const h = hex[1].toLowerCase();
    return (
      h.slice(0, 8) +
      "-" +
      h.slice(8, 12) +
      "-" +
      h.slice(12, 16) +
      "-" +
      h.slice(16, 20) +
      "-" +
      h.slice(20)
    );
  }

  async function testToken(token) {
    const me = await notionFetch(token, "/users/me");
    const name =
      (me.bot && me.bot.owner && me.bot.owner.user && me.bot.owner.user.name) ||
      me.name ||
      (me.bot && me.bot.workspace_name) ||
      "conexão ok";
    return {
      id: me.id,
      name,
      type: me.type || "bot",
      workspace: (me.bot && me.bot.workspace_name) || ""
    };
  }

  async function paginate(token, path, body) {
    const results = [];
    let cursor = undefined;
    do {
      const payload = { ...(body || {}) };
      if (cursor) payload.start_cursor = cursor;
      const page = await notionFetch(token, path, {
        method: "POST",
        body: payload
      });
      (page.results || []).forEach((r) => results.push(r));
      cursor = page.has_more ? page.next_cursor : null;
    } while (cursor);
    return results;
  }

  async function listDataSources(token) {
    const results = await paginate(token, "/search", {
      filter: { property: "object", value: "database" },
      page_size: 100
    });
    return results
      .filter((r) => r.object === "database")
      .map((r) => ({
        id: r.id,
        title: richPlain(r.title) || "Sem título",
        url: r.url || "",
        properties: r.properties || {}
      }));
  }

  async function retrieveDataSource(token, id) {
    const cached = cacheGet(dsCache, id, DS_TTL);
    if (cached) return cached;
    const ds = await notionFetch(token, "/databases/" + id);
    return cacheSet(dsCache, id, ds);
  }

  async function resolveDataSource(token, input) {
    const id = parseNotionId(input);
    if (!id) throw new Error("ID ou URL do Notion inválidos.");
    return retrieveDataSource(token, id);
  }

  function decodePropId(id) {
    const s = String(id == null ? "" : id);
    if (!s) return "";
    try {
      return decodeURIComponent(s);
    } catch (_) {
      return s;
    }
  }

  function propertyNameById(properties) {
    const byId = {};
    Object.keys(properties || {}).forEach((name) => {
      const p = properties[name] || {};
      const id = p.id != null ? String(p.id) : "";
      if (id) {
        byId[id] = name;
        byId[decodePropId(id)] = name;
      }
      byId[name] = name;
    });
    return byId;
  }

  function viewPropertyColumns(view) {
    const cfg = (view && view.configuration) || {};
    if (Array.isArray(cfg.properties) && cfg.properties.length) return cfg.properties;
    if (Array.isArray(cfg.table_properties) && cfg.table_properties.length) {
      return cfg.table_properties;
    }
    return [];
  }

  function orderFromViewConfig(view, properties) {
    const cols = viewPropertyColumns(view);
    if (!cols.length) return [];
    const byId = propertyNameById(properties);
    const seen = {};
    const names = [];
    cols.forEach((col) => {
      const raw =
        col &&
        (col.property_id ||
          col.propertyId ||
          col.id ||
          col.name ||
          col.property_name);
      const name =
        (raw != null && (byId[String(raw)] || byId[decodePropId(raw)])) || "";
      if (!name || !properties[name] || seen[name]) return;
      seen[name] = true;
      names.push(name);
    });
    Object.keys(properties).forEach((name) => {
      if (!seen[name]) names.push(name);
    });
    return names;
  }

  async function listViewRefs(token, dataSourceId, databaseId) {
    const urls = [];
    if (dataSourceId) {
      urls.push(
        "/views?data_source_id=" +
          encodeURIComponent(dataSourceId) +
          "&page_size=100"
      );
    }
    if (databaseId) {
      urls.push(
        "/views?database_id=" +
          encodeURIComponent(databaseId) +
          "&page_size=100"
      );
    }
    const seen = {};
    const refs = [];
    for (let i = 0; i < urls.length; i += 1) {
      try {
        const list = await notionFetch(token, urls[i]);
        ((list && list.results) || []).forEach((r) => {
          if (!r || !r.id || seen[r.id]) return;
          seen[r.id] = true;
          refs.push(r);
        });
      } catch (_) {
        /* tenta o próximo */
      }
    }
    return refs;
  }

  async function propertyOrderFromViews(token, dataSourceId, properties, databaseId) {
    const fallback = Object.keys(properties || {});
    try {
      const refs = await listViewRefs(token, dataSourceId, databaseId);
      if (!refs.length) return fallback;
      let tableOrder = [];
      let anyOrder = [];
      for (let i = 0; i < refs.length; i += 1) {
        const id = refs[i] && refs[i].id;
        if (!id) continue;
        let view = null;
        try {
          view = await notionFetch(token, "/views/" + id);
        } catch (_) {
          view = null;
        }
        const names = orderFromViewConfig(view, properties);
        if (!names.length) continue;
        if (!anyOrder.length) anyOrder = names;
        if (view && view.type === "table") {
          tableOrder = names;
          break;
        }
      }
      return tableOrder.length ? tableOrder : anyOrder.length ? anyOrder : fallback;
    } catch (_) {
      return fallback;
    }
  }

  async function inspectDataSource(token, dataSourceId) {
    const ds = await retrieveDataSource(token, dataSourceId);
    const properties = ds.properties || {};
    const databaseId =
      (ds.parent && ds.parent.database_id) ||
      (ds.parent && ds.parent.type === "database_id" && ds.parent.database_id) ||
      "";
    const propertyOrder = await propertyOrderFromViews(
      token,
      dataSourceId,
      properties,
      databaseId
    );
    const schema = {
      properties,
      propertyOrder: propertyOrder.slice()
    };
    const mapping = Schema().autoMap(schema);
    return {
      id: ds.id,
      title: richPlain(ds.title) || "Sem título",
      url: ds.url || "",
      schema,
      mapping,
      missing: Schema().missingPrepared(schema),
      types: Schema().mappingTypes(schema, mapping),
      statusOptions: Schema().selectOptions(schema, mapping.status),
      labelOptions: Schema().selectOptions(schema, mapping.labels)
    };
  }

  async function prepareDataSource(token, dataSourceId) {
    const ds = await retrieveDataSource(token, dataSourceId);
    const schema = { properties: ds.properties || {} };
    const missing = Schema().missingPrepared(schema);
    if (!missing.length) {
      return inspectDataSource(token, dataSourceId);
    }
    const properties = {};
    missing.forEach((name) => {
      properties[name] = Schema().PREPARE_PROPERTIES[name];
    });
    await notionFetch(token, "/databases/" + dataSourceId, {
      method: "PATCH",
      body: { properties }
    });
    invalidateSchemaCache(dataSourceId);
    return inspectDataSource(token, dataSourceId);
  }

  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  async function queryByProcessNumbers(token, settings, numbers, opts) {
    const unique = [...new Set((numbers || []).map((n) => String(n).trim()).filter(Boolean))];
    const mapping = settings.mapping;
    const light = !!(opts && opts.light);
    const ds = await retrieveDataSource(token, settings.dataSourceId);
    const schema = { properties: ds.properties || {} };
    const types = Schema().mappingTypes(schema, mapping);
    const pages = [];

    if (unique.length) {
      for (const group of chunk(unique, 80)) {
        const filter = Schema().processNumberFilter(mapping, types, group);
        if (!filter) continue;
        const results = await paginate(
          token,
          "/databases/" + settings.dataSourceId + "/query",
          { filter, page_size: 100 }
        );
        results.forEach((p) => {
          if (p.object === "page") pages.push(p);
        });
      }
    }

    const summarized = pages.map((p) => Schema().summarizePage(p, mapping));
    let users = [];
    let templates = [];
    if (!light) {
      const extras = Schema().extraFieldDefs(schema, mapping, []);
      const needsUsers = extras.some((f) => f && f.type === "people");
      if (needsUsers) {
        try {
          users = await listUsers(token);
        } catch (_) {
          users = [];
        }
      }
      try {
        templates = await listTemplates(token, settings.dataSourceId, mapping);
      } catch (_) {
        templates = [];
      }
    }
    return {
      pages: summarized,
      statusOptions: Schema().selectOptions(schema, mapping.status),
      labelOptions: Schema().selectOptions(schema, mapping.labels),
      mapping,
      extraFields: Schema().extraFieldDefs(schema, mapping, users),
      users,
      templates
    };
  }

  function extractPageTitle(page) {
    if (!page) return "";
    if (page.properties) {
      for (const key of Object.keys(page.properties)) {
        const prop = page.properties[key];
        if (prop && prop.type === "title" && Array.isArray(prop.title)) {
          const t = prop.title
            .map((x) => x.plain_text || (x.text && x.text.content) || "")
            .join("")
            .trim();
          if (t) return t;
        }
      }
    }
    if (Array.isArray(page.title)) {
      const t = page.title.map((x) => x.plain_text || (x.text && x.text.content) || "").join("").trim();
      if (t) return t;
    }
    return "";
  }

  function isTemplateCandidate(page, title, mapping) {
    if (!page) return false;
    if (page.archived || page.in_trash) return false;
    if (page.object !== "page") return false;

    if (page.is_template === true) return true;

    const t = String(title || "").trim();
    if (!t) return false;

    if (/^(empty|vazio|untitled|sem título|sem titulo)$/i.test(t)) {
      return false;
    }

    if (/[\(\[](inativo|arquivado|obsoleto|desativado|lixeira|trash|archived)[\)\]]/i.test(t)) {
      return false;
    }
    // A real SEI process number in the title is definitely an actual process, not a template
    if (
      /\d{4,7}\.\d{4,7}\/\d{4}-\d{2}/.test(t) ||
      /\d{5,}\.\d{6,}\//.test(t) ||
      /^\d{15,25}$/.test(t.replace(/\D/g, ""))
    ) {
      return false;
    }

    if (page.properties) {
      if (mapping && mapping.processRelation && page.properties[mapping.processRelation]) {
        const rel = page.properties[mapping.processRelation];
        if (rel.type === "relation" && Array.isArray(rel.relation) && rel.relation.length > 0) {
          return false;
        }
      }

      if (mapping && mapping.processNumber && page.properties[mapping.processNumber]) {
        const nupProp = page.properties[mapping.processNumber];
        let nupVal = "";
        if (nupProp.type === "title" && Array.isArray(nupProp.title)) {
          nupVal = nupProp.title.map((x) => x.plain_text || (x.text && x.text.content) || "").join("").trim();
        } else if (nupProp.type === "rich_text" && Array.isArray(nupProp.rich_text)) {
          nupVal = nupProp.rich_text.map((x) => x.plain_text || (x.text && x.text.content) || "").join("").trim();
        }
        if (nupVal && /\d{4,}/.test(nupVal)) {
          return false;
        }
      }

      if (mapping && mapping.seiUrl && page.properties[mapping.seiUrl]) {
        const urlProp = page.properties[mapping.seiUrl];
        let urlVal = "";
        if (urlProp.type === "url" && urlProp.url) {
          urlVal = urlProp.url;
        } else if (urlProp.type === "rich_text" && Array.isArray(urlProp.rich_text)) {
          urlVal = urlProp.rich_text.map((x) => x.plain_text || (x.text && x.text.content) || "").join("").trim();
        }
        if (urlVal && /sei|procedimento|controlar/i.test(urlVal)) {
          return false;
        }
      }

      for (const key of Object.keys(page.properties)) {
        const prop = page.properties[key];
        if (!prop) continue;

        let valText = "";
        if (prop.type === "rich_text" && Array.isArray(prop.rich_text)) {
          valText = prop.rich_text.map((x) => x.plain_text || (x.text && x.text.content) || "").join("").trim();
        } else if (prop.type === "title" && Array.isArray(prop.title)) {
          valText = prop.title.map((x) => x.plain_text || (x.text && x.text.content) || "").join("").trim();
        } else if (prop.type === "url" && prop.url) {
          valText = prop.url;
        }

        // Check if any property contains a real SEI process number
        if (valText && (/\d{4,7}\.\d{4,7}\/\d{4}-\d{2}/.test(valText) || /\d{5,}\.\d{6}\//.test(valText))) {
          return false;
        }
        if (/numero|número|processo|nup/i.test(key) && /\d{4,}/.test(valText)) {
          return false;
        }
        if (/url|link/i.test(key) && /procedimento_trabalhar|controlar/i.test(valText)) {
          return false;
        }

        if (prop.type === "checkbox") {
          if (/ativo|ativa|active/i.test(key) && prop.checkbox === false) {
            return false;
          }
          if (/inativo|inativa|arquivado|obsoleto/i.test(key) && prop.checkbox === true) {
            return false;
          }
        }

        if (prop.type === "select" && prop.select && prop.select.name) {
          const val = String(prop.select.name).trim();
          if (/^(inativo|desativado|arquivado|obsoleto|archived|trash)$/i.test(val)) {
            return false;
          }
        }

        if (prop.type === "status" && prop.status && prop.status.name) {
          const val = String(prop.status.name).trim();
          if (/^(inativo|desativado|arquivado|obsoleto|archived|trash)$/i.test(val)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  function sameId(a, b) {
    if (!a || !b) return false;
    const cleanA = String(a).replace(/-/g, "").toLowerCase();
    const cleanB = String(b).replace(/-/g, "").toLowerCase();
    return cleanA === cleanB;
  }

  async function listTemplates(token, dataSourceId, mapping) {
    const templates = [];
    if (!dataSourceId) return templates;
    const cached = cacheGet(templateCache, dataSourceId, TPL_TTL);
    if (cached) return cached;

    function addTemplate(p) {
      if (!p || p.archived || p.in_trash) return;
      const title = extractPageTitle(p);
      if (!title) return;
      // Ignore Notion's built-in default empty template
      if (/^(empty|vazio)$/i.test(title.trim())) return;
      if (!isTemplateCandidate(p, title, mapping)) return;
      if (!templates.some((t) => sameId(t.id, p.id))) {
        templates.push({
          id: p.id,
          name: title
        });
      }
    }

    try {
      const s = await notionFetch(token, "/search", {
        method: "POST",
        body: {
          filter: { property: "object", value: "page" },
          page_size: 100
        }
      });
      (s.results || []).forEach((p) => {
        if (!p || !p.parent) return;
        const parentDbId =
          p.parent.database_id ||
          p.parent.data_source_id ||
          (p.parent.type === "database_id" ? p.parent.database_id : "") ||
          "";
        if (sameId(parentDbId, dataSourceId)) {
          addTemplate(p);
        }
      });
    } catch (_) {
      /* ignore */
    }

    return cacheSet(templateCache, dataSourceId, templates);
  }

  function templatePayload(choice) {
    if (!choice) return null;
    const tz = "America/Sao_Paulo";
    if (choice === "default" || choice.type === "default") {
      return { type: "default", timezone: tz };
    }
    const id = choice.id || choice.template_id;
    if (!id) return null;
    return { type: "template_id", template_id: id, timezone: tz };
  }

  async function listBlockChildren(token, blockId) {
    const results = [];
    if (!blockId) return results;
    let cursor = "";
    do {
      let path =
        "/blocks/" + encodeURIComponent(blockId) + "/children?page_size=100";
      if (cursor) path += "&start_cursor=" + encodeURIComponent(cursor);
      const page = await notionFetch(token, path);
      (page.results || []).forEach((b) => results.push(b));
      cursor = page.has_more ? page.next_cursor || "" : "";
    } while (cursor);
    return results;
  }

  function todoFromBlock(block, depth, parentId) {
    if (!block || block.type !== "to_do" || !block.to_do) return null;
    const text = (block.to_do.rich_text || [])
      .map((t) => t.plain_text || (t.text && t.text.content) || "")
      .join("");
    return {
      id: block.id,
      text: String(text || "").trim() || "(item)",
      checked: !!block.to_do.checked,
      depth: Number(depth || 0),
      parentId: parentId || null
    };
  }

  async function listChecklist(token, pageId, opts) {
    const items = [];
    if (!pageId) return items;
    const shallow = !!(opts && opts.shallow);
    async function walk(id, depth, pId) {
      const blocks = await listBlockChildren(token, id);
      for (let i = 0; i < blocks.length; i += 1) {
        const b = blocks[i];
        const todo = todoFromBlock(b, depth, pId);
        if (todo) items.push(todo);
        if (!shallow && b && b.has_children && b.id && depth < 3) {
          await walk(b.id, depth + 1, b.id);
        }
      }
    }
    await walk(pageId, 0, null);
    return items;
  }

  async function mapPool(items, limit, fn) {
    const list = Array.isArray(items) ? items : [];
    const out = new Array(list.length);
    let cursor = 0;
    const n = Math.max(1, Math.min(limit || 3, list.length || 1));
    async function worker() {
      while (cursor < list.length) {
        const idx = cursor;
        cursor += 1;
        out[idx] = await fn(list[idx], idx);
      }
    }
    await Promise.all(Array.from({ length: Math.min(n, list.length) }, worker));
    return out;
  }

  async function waitForChecklist(token, pageId, timeoutMs) {
    const until = Date.now() + (timeoutMs || 5000);
    let items = [];
    while (Date.now() < until) {
      items = await listChecklist(token, pageId);
      if (items.length) return items;
      const blocks = await listBlockChildren(token, pageId);
      if (blocks.length) return items;
      await sleep(400);
    }
    return items;
  }

  async function applyTemplate(token, pageId, templateId, opts) {
    if (!pageId || !templateId) throw new Error("Parâmetros inválidos.");
    const templateBlocks = await listBlockChildren(token, templateId);
    const newChildren = [];
    templateBlocks.forEach((b) => {
      if (b.type === "to_do" && b.to_do) {
        newChildren.push({
          object: "block",
          type: "to_do",
          to_do: {
            rich_text: b.to_do.rich_text && b.to_do.rich_text.length
              ? b.to_do.rich_text
              : [{ type: "text", text: { content: "(item sem texto)" } }],
            checked: false
          }
        });
      }
    });

    if (newChildren.length) {
      await notionFetch(token, "/blocks/" + encodeURIComponent(pageId) + "/children", {
        method: "PATCH",
        body: { children: newChildren }
      });
    }

    const items = await waitForChecklist(token, pageId, 5000);
    return items;
  }

  async function setTodoChecked(token, blockId, checked) {
    return notionFetch(token, "/blocks/" + encodeURIComponent(blockId), {
      method: "PATCH",
      body: { to_do: { checked: !!checked } }
    });
  }

  function todoBlock(item) {
    const text = String((item && item.text) || "").trim();
    if (!text) return null;
    return {
      type: "to_do",
      to_do: {
        rich_text: [
          { type: "text", text: { content: text.slice(0, 2000) } }
        ],
        checked: !!(item && item.checked)
      }
    };
  }

  async function appendTodos(token, pageId, items) {
    if (!pageId || !items || !items.length) {
      return pageId ? listChecklist(token, pageId) : [];
    }
    const depthMap = { 0: pageId };
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const block = todoBlock(item);
      if (!block) continue;
      const depth = Math.max(0, Math.min(2, Number(item.depth || 0)));
      let parentId = (depth > 0 && depthMap[depth - 1]) ? depthMap[depth - 1] : pageId;
      try {
        const res = await notionFetch(
          token,
          "/blocks/" + encodeURIComponent(parentId) + "/children",
          {
            method: "PATCH",
            body: { children: [block] }
          }
        );
        const created = res && res.results && res.results[0];
        if (created && created.id) {
          depthMap[depth] = created.id;
        }
      } catch (_) {
        try {
          const res = await notionFetch(
            token,
            "/blocks/" + encodeURIComponent(pageId) + "/children",
            {
              method: "PATCH",
              body: { children: [block] }
            }
          );
          const created = res && res.results && res.results[0];
          if (created && created.id) {
            depthMap[0] = created.id;
          }
        } catch (_) {
          /* ignore */
        }
      }
    }
    return listChecklist(token, pageId);
  }

  async function updateTodo(token, blockId, patch) {
    if (!blockId) throw new Error("Item ausente.");
    const body = { to_do: {} };
    if (patch && "checked" in patch) body.to_do.checked = !!patch.checked;
    if (patch && "text" in patch) {
      const text = String(patch.text || "").trim().slice(0, 2000);
      body.to_do.rich_text = text
        ? [{ type: "text", text: { content: text } }]
        : [];
    }
    await notionFetch(token, "/blocks/" + encodeURIComponent(blockId), {
      method: "PATCH",
      body
    });
  }

  async function deleteBlock(token, blockId) {
    if (!blockId) throw new Error("Item ausente.");
    return notionFetch(token, "/blocks/" + encodeURIComponent(blockId), {
      method: "DELETE"
    });
  }

  async function listUsers(token) {
    if (usersCache && Date.now() - usersCache.at < USERS_TTL) {
      return usersCache.value;
    }
    const users = [];
    let cursor = "";
    do {
      let path = "/users?page_size=100";
      if (cursor) path += "&start_cursor=" + encodeURIComponent(cursor);
      const page = await notionFetch(token, path);
      (page.results || []).forEach((u) => {
        if (!u || !u.id) return;
        users.push({
          id: u.id,
          name: u.name || (u.person && u.person.email) || u.id
        });
      });
      cursor = page.has_more ? page.next_cursor : "";
    } while (cursor);
    usersCache = { at: Date.now(), value: users };
    return users;
  }

  function findInResults(pages, processNumber) {
    return (pages || []).find((p) =>
      Schema().sameNup(p.processNumber, processNumber)
    );
  }

  async function findPageByProcessNumber(token, settings, processNumber) {
    if (!processNumber) return null;
    const result = await queryByProcessNumbers(token, settings, [processNumber]);
    return findInResults(result.pages, processNumber) || null;
  }

  function keepIdentity(summary, data, previous) {
    const out = { ...(previous || {}), ...(summary || {}) };
    if (previous && previous.pageId && !out.pageId) out.pageId = previous.pageId;
    if (!data) return out;
    if (data.processNumber) out.processNumber = data.processNumber;
    if (data.name) out.title = data.name;
    if ("description" in data) out.notes = data.description;
    if ("statusName" in data) {
      out.status = data.statusName
        ? {
            name: data.statusName,
            color: (out.status && out.status.color) || "default"
          }
        : null;
    }
    if ("due" in data) out.due = data.due;
    if (Array.isArray(data.labels)) {
      out.labels = data.labels.map((n) =>
        typeof n === "string" ? { name: n } : n
      );
    }
    if ("assignee" in data) out.assignee = data.assignee || "";
    if ("processType" in data) out.processType = data.processType || "";
    if (data.extra && typeof data.extra === "object") {
      out.extra = { ...(out.extra || {}), ...data.extra };
    }
    return out;
  }

  function editorFromSettings(settings) {
    return {
      id: (settings && settings.editorId) || "anon",
      name: (settings && settings.editorName) || "Alguém"
    };
  }

  async function retrievePage(token, pageId) {
    return notionFetch(token, "/pages/" + pageId);
  }

  async function ensureLockProperty(token, settings) {
    const ds = await retrieveDataSource(token, settings.dataSourceId);
    const props = ds.properties || {};
    const name = Schema().LOCK_PROPERTY;
    if (props[name] && props[name].type === "rich_text") return;
    await notionFetch(token, "/databases/" + settings.dataSourceId, {
      method: "PATCH",
      body: { properties: { [name]: { rich_text: {} } } }
    });
  }

  function lockError(lock) {
    const who = (lock && lock.name) || "Outra pessoa";
    const err = new Error(
      who + " está editando este processo. Aguarde ou tente de novo em instantes."
    );
    err.code = "locked";
    err.lock = lock;
    return err;
  }

  async function acquireLock(token, settings, pageId) {
    await ensureLockProperty(token, settings);
    const editor = editorFromSettings(settings);
    const current = Schema().summarizePage(
      await retrievePage(token, pageId),
      settings.mapping
    );
    if (Schema().lockHeldByOther(current.lock, editor.id)) {
      return { ok: false, held: false, lock: current.lock, page: current };
    }
    const lock = Schema().makeLock(editor);
    await notionFetch(token, "/pages/" + pageId, {
      method: "PATCH",
      body: {
        properties: {
          [Schema().LOCK_PROPERTY]: {
            rich_text: [
              { type: "text", text: { content: Schema().encodeLock(lock) } }
            ]
          }
        }
      }
    });
    const again = Schema().summarizePage(
      await retrievePage(token, pageId),
      settings.mapping
    );
    const held = !!(again.lock && again.lock.id === editor.id);
    return { ok: held, held, lock: again.lock, page: again };
  }

  async function releaseLock(token, settings, pageId) {
    const editor = editorFromSettings(settings);
    try {
      const current = Schema().summarizePage(
        await retrievePage(token, pageId),
        settings.mapping
      );
      if (!current.lock || current.lock.id !== editor.id) {
        return { ok: true, released: false, page: current };
      }
      await notionFetch(token, "/pages/" + pageId, {
        method: "PATCH",
        body: {
          properties: {
            [Schema().LOCK_PROPERTY]: { rich_text: [] }
          }
        }
      });
      return { ok: true, released: true };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  async function createPage(token, settings, data) {
    const editor = editorFromSettings(settings);
    const existing = await findPageByProcessNumber(
      token,
      settings,
      data.processNumber
    );
    if (existing) {
      if (Schema().lockHeldByOther(existing.lock, editor.id)) {
        throw lockError(existing.lock);
      }
      return updatePage(token, settings, existing.pageId, data, existing);
    }

    await ensureLockProperty(token, settings);
    const ds = await retrieveDataSource(token, settings.dataSourceId);
    const schema = { properties: ds.properties || {} };
    const types = Schema().mappingTypes(schema, settings.mapping);
    const properties = Schema().writeProperties(settings.mapping, types, {
      ...data,
      name: data.name || data.processNumber,
      lock: Schema().makeLock(editor)
    });
    let templates = [];
    try {
      templates = await listTemplates(token, settings.dataSourceId);
    } catch (_) {
      templates = [];
    }
    const customItems = Array.isArray(data.checklist)
      ? data.checklist.filter((i) => String((i && i.text) || "").trim())
      : [];
    let matched = null;
    if (!customItems.length && data.templateId) {
      matched =
        templates.find((t) => t.id === data.templateId) || {
          id: data.templateId
        };
    }
    const template = templatePayload(matched);
    const body = {
      parent: { database_id: settings.dataSourceId },
      properties
    };
    if (template) body.template = template;
    const page = await notionFetch(token, "/pages", {
      method: "POST",
      body
    });
    const summary = keepIdentity(
      Schema().summarizePage(page, settings.mapping),
      data,
      null
    );
    let checklist = [];
    if (template && summary.pageId) {
      checklist = await waitForChecklist(token, summary.pageId, 8000);
    }
    if (customItems.length && summary.pageId) {
      checklist = await appendTodos(token, summary.pageId, customItems);
    }
    summary.checklist = checklist;
    summary.templates = templates;
    summary.appliedTemplate = matched ? matched.name : "";

    if (settings.activitiesDataSourceId && summary.pageId && matched && matched.id) {
      try {
        await importActivitiesFromTemplate(token, settings, {
          processPageId: summary.pageId,
          templateId: matched.id,
          templateName: matched.name,
          assignee: data.assignee,
          due: data.due
        });
      } catch (_) {
        /* ignore */
      }
    }

    return summary;
  }

  async function updatePage(token, settings, pageId, data, previous) {
    const editor = editorFromSettings(settings);
    const current = Schema().summarizePage(
      await retrievePage(token, pageId),
      settings.mapping
    );
    if (Schema().lockHeldByOther(current.lock, editor.id)) {
      throw lockError(current.lock);
    }
    const ds = await retrieveDataSource(token, settings.dataSourceId);
    const schema = { properties: ds.properties || {} };
    const types = Schema().mappingTypes(schema, settings.mapping);
    const properties = Schema().writeProperties(settings.mapping, types, data);
    const page = await notionFetch(token, "/pages/" + pageId, {
      method: "PATCH",
      body: { properties }
    });
    return keepIdentity(
      Schema().summarizePage(page, settings.mapping),
      data,
      previous || current
    );
  }

  async function inspectActivitiesDataSource(token, activitiesDataSourceId, processDataSourceId) {
    const ds = await retrieveDataSource(token, activitiesDataSourceId);
    const properties = ds.properties || {};
    const schema = { properties };
    const mapping = Schema().autoMapActivities(schema, processDataSourceId);
    const statusColumns = Schema().extractStatusColumns(schema, mapping.status);
    const hasRelation = !!(mapping.processRelation && Schema().findProperty(schema, mapping.processRelation));

    return {
      id: ds.id,
      title: richPlain(ds.title) || "Sem título",
      url: ds.url || "",
      schema,
      mapping,
      statusColumns,
      hasRelation
    };
  }

  async function prepareActivitiesDataSource(token, activitiesDataSourceId, processDataSourceId) {
    const ds = await retrieveDataSource(token, activitiesDataSourceId);
    const properties = ds.properties || {};
    const schema = { properties };
    const patchProps = {};

    let statusProp = Schema().findProperty(schema, "Status");
    if (!statusProp) {
      const anyStatus = Object.values(properties).find(
        (p) => p.type === "status" || p.type === "select"
      );
      if (!anyStatus) {
        patchProps["Status"] = {
          select: {
            options: [
              { name: "A Fazer", color: "gray" },
              { name: "Em Andamento", color: "blue" },
              { name: "Concluído", color: "green" }
            ]
          }
        };
      }
    }

    let relProp = Schema().findRelationProperty(schema, processDataSourceId);
    if (!relProp && processDataSourceId) {
      patchProps["Processo SEI"] = {
        relation: {
          database_id: processDataSourceId,
          single_property: {}
        }
      };
    }

    let assProp = Schema().findProperty(schema, "Responsável") || Schema().findProperty(schema, "Atribuição");
    if (!assProp) {
      const anyPeople = Object.values(properties).find(
        (p) => p.type === "people" || p.type === "rich_text"
      );
      if (!anyPeople) {
        patchProps["Responsável"] = { people: {} };
      }
    }

    let dueProp = Schema().findProperty(schema, "Prazo");
    if (!dueProp) {
      const anyDate = Object.values(properties).find((p) => p.type === "date");
      if (!anyDate) {
        patchProps["Prazo"] = { date: {} };
      }
    }

    if (!Schema().findActivityOrderProperty(schema)) {
      patchProps["Ordem"] = { number: { format: "number" } };
    }

    if (Object.keys(patchProps).length > 0) {
      await notionFetch(token, "/databases/" + activitiesDataSourceId, {
        method: "PATCH",
        body: { properties: patchProps }
      });
      invalidateSchemaCache(activitiesDataSourceId);
    }

    return inspectActivitiesDataSource(token, activitiesDataSourceId, processDataSourceId);
  }

  async function queryActivitiesByProcess(token, settings, processPageId) {
    const actId = settings.activitiesDataSourceId;
    if (!actId || !processPageId) {
      return { activities: [], statusColumns: [], templates: [] };
    }

    const ds = await retrieveDataSource(token, actId);
    const schema = { properties: ds.properties || {} };
    const mapping = settings.activitiesMapping && settings.activitiesMapping.status
      ? settings.activitiesMapping
      : Schema().autoMapActivities(schema, settings.dataSourceId);

    const statusPropName = (mapping && mapping.status) || "";
    let statusColumns = Schema().extractStatusColumns(schema, statusPropName);

    // Apply custom column order if saved
    const order = settings.activitiesColumnOrder || (mapping && mapping.statusOrder);
    if (Array.isArray(order) && order.length > 0) {
      const orderMap = new Map();
      order.forEach((name, idx) => orderMap.set(name, idx));
      statusColumns.sort((a, b) => {
        const idxA = orderMap.has(a.name) ? orderMap.get(a.name) : 9999;
        const idxB = orderMap.has(b.name) ? orderMap.get(b.name) : 9999;
        return idxA - idxB;
      });
    }

    let activities = [];
    const relPropName = mapping && mapping.processRelation;
    if (relPropName) {
      const filter = {
        property: relPropName,
        relation: { contains: processPageId }
      };

      try {
        const orderProp = Schema().findActivityOrderProperty(schema);
        const sorts = orderProp
          ? [{ property: orderProp, direction: "ascending" }]
          : [{ timestamp: "created_time", direction: "ascending" }];
        const results = await paginate(token, "/databases/" + actId + "/query", {
          filter,
          sorts,
          page_size: 100
        });

        const knownStatusNames = new Set(statusColumns.map((c) => c.name));
        const pending = [];

        for (let i = 0; i < results.length; i += 1) {
          const p = results[i];
          if (p.object !== "page" || p.archived || p.in_trash) continue;
          const act = Schema().summarizeActivity(p, mapping);
          if (act) {
            if (act.statusName && !knownStatusNames.has(act.statusName)) {
              statusColumns.push({
                id: act.statusName,
                name: act.statusName,
                color: act.statusColor || "default"
              });
              knownStatusNames.add(act.statusName);
            }
            pending.push(act);
          }
        }
        await mapPool(pending, 3, async (act) => {
          try {
            const checklist = await listChecklist(token, act.activityId, {
              shallow: true
            });
            act.checklist = checklist;
            act.todoCount = checklist.length;
            act.todoCompleted = checklist.filter((t) => t.checked).length;
          } catch (_) {
            act.checklist = [];
            act.todoCount = 0;
            act.todoCompleted = 0;
          }
          return act;
        });
        activities = Schema().sortActivities(pending);
      } catch (_) {
        activities = [];
      }
    }

    let templates = [];
    try {
      templates = await listTemplates(token, actId, mapping);
    } catch (_) {
      templates = [];
    }

    return {
      activities,
      statusColumns,
      templates
    };
  }

  function extractBlockText(b) {
    if (!b || !b.type) return "";
    const typeObj = b[b.type];
    if (!typeObj) return "";
    if (typeof typeObj.title === "string" && typeObj.title.trim()) {
      return typeObj.title.trim();
    }
    const rich = typeObj.rich_text || (Array.isArray(typeObj.title) ? typeObj.title : []);
    if (!Array.isArray(rich)) return "";
    return rich
      .map((t) => t.plain_text || (t.text && t.text.content) || "")
      .join("")
      .trim();
  }

  async function importActivitiesFromTemplate(token, settings, data) {
    const actId = settings.activitiesDataSourceId;
    const mapping = settings.activitiesMapping;
    if (!actId || !mapping || !data.processPageId || !data.templateId) {
      throw new Error("Configuração incompleta ou modelo não informado.");
    }

    try {
      const ds = await retrieveDataSource(token, actId);
      const schema = { properties: ds.properties || {} };
      if (!Schema().findActivityOrderProperty(schema)) {
        await notionFetch(token, "/databases/" + actId, {
          method: "PATCH",
          body: { properties: { Ordem: { number: { format: "number" } } } }
        });
        invalidateSchemaCache(actId);
      }
    } catch (_) {
      /* coluna Ordem é opcional se o banco não permitir PATCH */
    }

    const templateId = data.templateId;
    const processPageId = data.processPageId;
    const defaultStatusName = data.statusName || "";
    const defaultAssignee = data.assignee || "";
    const defaultDue = data.due || "";

    async function extractTemplateItems(parentId) {
      const topBlocks = await listBlockChildren(token, parentId);
      const items = [];

      for (const b of topBlocks) {
        if (!b) continue;

        if (
          b.type === "column_list" ||
          b.type === "column" ||
          b.type === "synced_block" ||
          b.type === "template"
        ) {
          if (b.has_children) {
            const nested = await extractTemplateItems(b.id);
            items.push(...nested);
          }
          continue;
        }

        if (
          b.type === "divider" ||
          b.type === "table_of_contents" ||
          b.type === "breadcrumb" ||
          b.type === "link_to_page" ||
          b.type === "child_database"
        ) {
          continue;
        }

        const text = extractBlockText(b);
        const isSection =
          (b.type === "heading_1" ||
            b.type === "heading_2" ||
            b.type === "heading_3" ||
            b.type === "toggle") &&
          /^(atividades|tarefas|checklist|etapas|passos|tasks|activities)/i.test(
            text
          );

        let children = [];
        if (b.has_children) {
          try {
            children = await listBlockChildren(token, b.id);
          } catch (_) {
            children = [];
          }
        }

        if (isSection) {
          if (children.length) {
            const nested = await extractTemplateItems(b.id);
            items.push(...nested);
          }
          continue;
        }

        if (!text) {
          if (children.length) {
            const nested = await extractTemplateItems(b.id);
            items.push(...nested);
          }
          continue;
        }

        const taskTypes = {
          to_do: true,
          bulleted_list_item: true,
          numbered_list_item: true,
          paragraph: true,
          quote: true,
          callout: true,
          child_page: true
        };
        const isGroup =
          b.type === "heading_1" ||
          b.type === "heading_2" ||
          b.type === "heading_3" ||
          b.type === "toggle" ||
          b.type === "bulleted_list_item" ||
          b.type === "numbered_list_item";
        const taskChildren = children.filter(
          (ch) => ch && taskTypes[ch.type] && extractBlockText(ch)
        );
        if (isGroup && taskChildren.length >= 2) {
          const nested = await extractTemplateItems(b.id);
          items.push(...nested);
          continue;
        }

        const checklist = [];
        children.forEach((ch) => {
          const chText = extractBlockText(ch);
          if (chText) {
            checklist.push({
              text: chText,
              checked: ch.type === "to_do" ? !!ch.to_do?.checked : false
            });
          }
        });

        items.push({
          title: text,
          checklist
        });
      }

      return items;
    }

    let parsedItems = [];
    try {
      parsedItems = await extractTemplateItems(templateId);
    } catch (_) {
      parsedItems = [];
    }

    if (!parsedItems.length) {
      let tplTitle = data.templateName || "Nova Atividade";
      try {
        const tplPage = await notionFetch(token, "/pages/" + encodeURIComponent(templateId));
        const extTitle = extractPageTitle(tplPage);
        if (extTitle) tplTitle = extTitle;
      } catch (_) {}

      const singleAct = await createActivity(token, settings, {
        processPageId,
        templateId,
        title: tplTitle,
        assignee: defaultAssignee,
        due: defaultDue,
        statusName: defaultStatusName
      });
      return [singleAct];
    }

    const createdActivities = [];
    for (let i = 0; i < parsedItems.length; i += 1) {
      const item = parsedItems[i];
      const act = await createActivity(token, settings, {
        processPageId,
        title: item.title,
        assignee: defaultAssignee,
        due: defaultDue,
        statusName: defaultStatusName,
        sortIndex: i
      });
      if (act) act.sortIndex = i;

      if (act && act.activityId && item.checklist.length > 0) {
        try {
          const childrenPayload = item.checklist.map((c) => ({
            object: "block",
            type: "to_do",
            to_do: {
              rich_text: [{ type: "text", text: { content: c.text.slice(0, 2000) } }],
              checked: !!c.checked
            }
          }));

          await notionFetch(token, "/blocks/" + encodeURIComponent(act.activityId) + "/children", {
            method: "PATCH",
            body: { children: childrenPayload }
          });

          const updatedChecklist = await listChecklist(token, act.activityId);
          act.checklist = updatedChecklist;
          act.todoCount = updatedChecklist.length;
          act.todoCompleted = updatedChecklist.filter((t) => t.checked).length;
        } catch (_) {
          /* ignore */
        }
      }

      createdActivities.push(act);
    }

    return createdActivities;
  }

  async function createActivity(token, settings, data) {
    const actId = settings.activitiesDataSourceId;
    const mapping = settings.activitiesMapping;
    if (!actId || !mapping || !data.processPageId) {
      throw new Error("Configuração do banco de atividades incompleta.");
    }

    const ds = await retrieveDataSource(token, actId);
    const schema = { properties: ds.properties || {} };
    const statusPropDef = mapping.status ? Schema().findProperty(schema, mapping.status) : null;
    const isStatusType = statusPropDef && statusPropDef.type === "status";

    const titlePropName = mapping.title || Schema().findTitleName(schema);
    const properties = {
      [titlePropName]: {
        title: [
          {
            type: "text",
            text: { content: String(data.title || "Nova Atividade").slice(0, 2000) }
          }
        ]
      },
      [mapping.processRelation]: {
        relation: [{ id: data.processPageId }]
      }
    };

    if (mapping.status && data.statusName) {
      if (isStatusType) {
        properties[mapping.status] = { status: { name: data.statusName } };
      } else {
        properties[mapping.status] = { select: { name: data.statusName } };
      }
    }

    if (mapping.assignee && data.assignee) {
      const assDef = Schema().findProperty(schema, mapping.assignee);
      if (assDef && assDef.type === "people") {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.assignee)) {
          properties[mapping.assignee] = { people: [{ id: data.assignee }] };
        }
      } else if (assDef && (assDef.type === "rich_text" || assDef.type === "title")) {
        properties[mapping.assignee] = {
          rich_text: [{ type: "text", text: { content: String(data.assignee).slice(0, 2000) } }]
        };
      }
    }

    if (mapping.due && data.due) {
      const dueDef = Schema().findProperty(schema, mapping.due);
      if (dueDef && dueDef.type === "date") {
        const iso = Schema().parseDateBr(data.due) || (data.due.match(/^\d{4}-\d{2}-\d{2}/) ? data.due : null);
        if (iso) {
          properties[mapping.due] = { date: { start: iso } };
        }
      }
    }

    const orderProp = Schema().findActivityOrderProperty(schema);
    if (orderProp && typeof data.sortIndex === "number" && Number.isFinite(data.sortIndex)) {
      properties[orderProp] = { number: data.sortIndex };
    }

    let matchedTemplate = null;
    if (data.templateId) {
      try {
        const templates = await listTemplates(token, actId);
        matchedTemplate = templates.find((t) => t.id === data.templateId) || {
          id: data.templateId
        };
      } catch (_) {
        matchedTemplate = { id: data.templateId };
      }
    }

    const template = templatePayload(matchedTemplate);
    const body = {
      parent: { database_id: actId },
      properties
    };
    if (template) body.template = template;

    const page = await notionFetch(token, "/pages", {
      method: "POST",
      body
    });

    const act = Schema().summarizeActivity(page, mapping);
    let checklist = [];
    if (template && act && act.activityId) {
      checklist = await waitForChecklist(token, act.activityId, 8000);
    }
    if (act) {
      act.checklist = checklist;
      act.todoCount = checklist.length;
      act.todoCompleted = checklist.filter((t) => t.checked).length;
    }
    return act;
  }

  async function updateActivity(token, settings, data) {
    const actId = settings.activitiesDataSourceId;
    const mapping = settings.activitiesMapping;
    const activityPageId = data.activityId;
    if (!activityPageId || !actId || !mapping) {
      throw new Error("ID da atividade ou configuração ausente.");
    }

    const ds = await retrieveDataSource(token, actId);
    const schema = { properties: ds.properties || {} };
    const properties = {};

    const titlePropName = mapping.title || Schema().findTitleName(schema);
    if (titlePropName && data.title != null) {
      properties[titlePropName] = {
        title: [
          {
            type: "text",
            text: { content: String(data.title || "Atividade").slice(0, 2000) }
          }
        ]
      };
    }

    if (mapping.status && data.statusName != null) {
      const statusPropDef = Schema().findProperty(schema, mapping.status);
      const isStatusType = statusPropDef && statusPropDef.type === "status";
      properties[mapping.status] = isStatusType
        ? { status: { name: data.statusName } }
        : { select: { name: data.statusName } };
    }

    if (mapping.assignee) {
      const assDef = Schema().findProperty(schema, mapping.assignee);
      if (assDef && assDef.type === "people") {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.assignee)) {
          properties[mapping.assignee] = { people: [{ id: data.assignee }] };
        } else if (!data.assignee) {
          properties[mapping.assignee] = { people: [] };
        }
      } else if (assDef && (assDef.type === "rich_text" || assDef.type === "title")) {
        properties[mapping.assignee] = {
          rich_text: data.assignee ? [{ type: "text", text: { content: String(data.assignee).slice(0, 2000) } }] : []
        };
      }
    }

    if (mapping.due) {
      const dueDef = Schema().findProperty(schema, mapping.due);
      if (dueDef && dueDef.type === "date") {
        const iso = data.due ? (Schema().parseDateBr(data.due) || (data.due.match(/^\d{4}-\d{2}-\d{2}/) ? data.due : null)) : null;
        properties[mapping.due] = iso ? { date: { start: iso } } : { date: null };
      }
    }

    const page = await notionFetch(token, "/pages/" + encodeURIComponent(activityPageId), {
      method: "PATCH",
      body: { properties }
    });

    const act = Schema().summarizeActivity(page, mapping);
    try {
      const checklist = await listChecklist(token, activityPageId);
      act.checklist = checklist;
      act.todoCount = checklist.length;
      act.todoCompleted = checklist.filter((t) => t.checked).length;
    } catch (_) {
      act.checklist = [];
      act.todoCount = 0;
      act.todoCompleted = 0;
    }
    return act;
  }

  async function updateActivityStatus(token, settings, activityPageId, statusName) {
    const actId = settings.activitiesDataSourceId;
    const mapping = settings.activitiesMapping;
    if (!activityPageId || !mapping || !mapping.status) {
      throw new Error("ID da atividade ou mapeamento de status ausente.");
    }

    const ds = await retrieveDataSource(token, actId);
    const schema = { properties: ds.properties || {} };
    const statusPropDef = Schema().findProperty(schema, mapping.status);
    const isStatusType = statusPropDef && statusPropDef.type === "status";

    const payload = isStatusType
      ? { status: { name: statusName } }
      : { select: { name: statusName } };

    await notionFetch(token, "/pages/" + encodeURIComponent(activityPageId), {
      method: "PATCH",
      body: {
        properties: {
          [mapping.status]: payload
        }
      }
    });

    return { ok: true, activityId: activityPageId, statusName };
  }

  async function deleteActivity(token, activityPageId) {
    if (!activityPageId) throw new Error("ID da atividade ausente.");
    return notionFetch(token, "/pages/" + encodeURIComponent(activityPageId), {
      method: "PATCH",
      body: { archived: true }
    });
  }

  root.SeiNotionApi = {
    VERSION,
    parseNotionId,
    testToken,
    listDataSources,
    retrieveDataSource,
    resolveDataSource,
    inspectDataSource,
    prepareDataSource,
    inspectActivitiesDataSource,
    prepareActivitiesDataSource,
    queryByProcessNumbers,
    queryActivitiesByProcess,
    findPageByProcessNumber,
    createPage,
    updatePage,
    createActivity,
    importActivitiesFromTemplate,
    updateActivity,
    updateActivityStatus,
    deleteActivity,
    acquireLock,
    releaseLock,
    listTemplates,
    listChecklist,
    applyTemplate,
    setTodoChecked,
    appendTodos,
    updateTodo,
    deleteBlock
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
