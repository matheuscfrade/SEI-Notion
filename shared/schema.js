/**
 * Mapeamento SEI ↔ propriedades do banco Notion.
 * Cada usuário escolhe o próprio database; os nomes padrão são só um palpite.
 */
(function (root) {

  const STANDARD_ROLES = [
    {
      key: "processNumber",
      label: "Número SEI",
      required: true,
      prepareName: "Número SEI",
      purpose: "Liga o processo do SEI à página no Notion. Sem esta coluna a extensão não encontra o card.",
      hints: ["numero sei", "nup", "numero do processo"]
    },
    {
      key: "processType",
      label: "Tipo de processo",
      required: false,
      recommended: true,
      prepareName: "Tipo de processo",
      purpose: "Tipo cadastrado no SEI (ex.: Contrato). A extensão preenche sozinha; não é editável no popup.",
      hints: ["tipo de processo", "tipo processo"]
    },
    {
      key: "status",
      label: "Status",
      required: false,
      recommended: true,
      prepareName: "Status",
      purpose: "Situação do processo (A fazer, Em andamento…). Também define a cor do botão N no SEI.",
      hints: ["status", "situacao", "fase"]
    }
  ];

  const LEGACY_ROLE_KEYS = ["title", "labels", "assignee", "due", "seiUrl", "notes"];
  const ROLE_KEYS = STANDARD_ROLES.map((r) => r.key).concat(LEGACY_ROLE_KEYS);

  const SEI_READONLY_ROLES = [
    "processNumber",
    "processType"
  ];


  const COMPAT = {
    title: ["title", "rich_text"],
    processNumber: ["rich_text", "title", "url"],
    processType: ["rich_text", "select"],
    status: ["status", "select", "rich_text"],
    labels: ["multi_select", "rich_text"],
    assignee: ["rich_text", "select"],
    due: ["date"],
    seiUrl: ["rich_text", "url"],
    notes: ["rich_text"]
  };

  const EXTRA_TYPES = [
    "rich_text",
    "select",
    "status",
    "date",
    "url",
    "checkbox",
    "number",
    "multi_select",
    "email",
    "phone_number",
    "people"
  ];

  const FIXED_ORDER_ROLES = [
    "processNumber",
    "processType"
  ];

  const PREPARE_PROPERTIES = {
    "Número SEI": { rich_text: {} },
    "Tipo de processo": { rich_text: {} },
    Status: {
      select: {
        options: [
          { name: "A fazer", color: "gray" },
          { name: "Em andamento", color: "blue" },
          { name: "Aguardando", color: "yellow" },
          { name: "Concluído", color: "green" }
        ]
      }
    },
    "SEI lock": { rich_text: {} }
  };

  const LOCK_PROPERTY = "SEI lock";
  const LOCK_TTL_MS = 90 * 1000;
  const SEI_URL_LINK_TEXT = "Abrir no SEI";

  function emptyMapping() {
    return {
      title: "",
      processNumber: "",
      processType: "",
      status: "",
      labels: "",
      assignee: "",
      due: "",
      seiUrl: "",
      notes: "",
      extra: [],
      order: [],
      orderCustom: false,
      badgeColorMap: {},
      hiddenRoles: []
    };
  }

  function mappedNames(mapping) {
    const names = [];
    ROLE_KEYS.forEach((key) => {
      if (mapping && mapping[key]) names.push(mapping[key]);
    });
    return new Set(names);
  }

  function isLockProperty(name) {
    return norm(name) === norm(LOCK_PROPERTY);
  }

  function extraCandidates(schema, mapping) {
    const used = mappedNames(mapping);
    return listProperties(schema).filter(
      (p) => !used.has(p.name) && !isLockProperty(p.name)
    );
  }

  function parseLock(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      if (!o || !o.id || !o.until) return null;
      return {
        id: String(o.id),
        name: String(o.name || "Alguém"),
        until: Number(o.until)
      };
    } catch (_) {
      return null;
    }
  }

  function encodeLock(lock) {
    if (!lock) return "";
    return JSON.stringify({
      id: lock.id,
      name: lock.name || "",
      until: lock.until
    });
  }

  function lockIsActive(lock) {
    return !!(lock && Number(lock.until) > Date.now());
  }

  function lockHeldByOther(lock, editorId) {
    return lockIsActive(lock) && lock.id && lock.id !== editorId;
  }

  function badgeBusyNup(state, popup) {
    const creating = state && state.creating;
    if (creating) return creating;
    if (!state || !state.loading) return "";
    if (popup && popup.isOpen) return popup.processNumber || "";
    return "";
  }

  function popupCloseIntent(opts) {
    const page = opts && opts.page;
    const form = opts && opts.form;
    const lockedByOther = !!(opts && opts.lockedByOther);
    const heldPageId = (opts && opts.heldPageId) || null;
    const currentHeldId =
      opts && "currentHeldId" in opts ? opts.currentHeldId : heldPageId;
    const lockSession = opts && opts.lockSession;
    const closeSession = opts && opts.closeSession;
    const reopenedSame =
      !!heldPageId &&
      lockSession !== closeSession &&
      currentHeldId === heldPageId;
    return {
      persist: !!(page && page.pageId && form && !lockedByOther),
      unlock: !!heldPageId && !reopenedSame,
      unlockPageId: heldPageId && !reopenedSame ? heldPageId : null,
      clearBusy: true
    };
  }

  function makeLock(editor, ttlMs) {
    return {
      id: editor && editor.id ? String(editor.id) : "anon",
      name: (editor && editor.name) || "Alguém",
      until: Date.now() + (ttlMs || LOCK_TTL_MS)
    };
  }

  function fieldOptions(prop) {
    if (!prop) return [];
    if (prop.type === "select") return (prop.select && prop.select.options) || [];
    if (prop.type === "status") return (prop.status && prop.status.options) || [];
    if (prop.type === "multi_select")
      return (prop.multi_select && prop.multi_select.options) || [];
    return [];
  }

  function extraNames(mapping) {
    const used = mappedNames(mapping);
    const names = [];
    function add(n) {
      n = String(n || "").trim();
      if (!n || isLockProperty(n) || used.has(n) || names.indexOf(n) !== -1) {
        return;
      }
      names.push(n);
    }
    (Array.isArray(mapping && mapping.extra) ? mapping.extra : []).forEach(add);
    return names;
  }

  function extraFieldDefs(schema, mapping, users) {
    const wanted = extraNames(mapping);
    return wanted
      .map((name) => {
        if (!name || isLockProperty(name)) return null;
        const p = findProperty(schema, name);
        if (!p) {
          return { name, type: "rich_text", options: [] };
        }
        let options = fieldOptions(p);
        if (p.type === "people") {
          options = (users || []).map((u) => ({
            id: u.id,
            name: u.name || u.id
          }));
        }
        return {
          name,
          type: p.type || "rich_text",
          options
        };
      })
      .filter(Boolean);
  }

  function mergeMapping(schema, saved) {
    const listed = listProperties(schema);
    const byName = {};
    listed.forEach((p) => {
      byName[p.name] = p;
    });
    const merged = emptyMapping();
    const guessed = autoMap(schema);
    ROLE_KEYS.forEach((key) => {
      const allowed = COMPAT[key] || [];
      const prev = saved && saved[key];
      if (prev && byName[prev] && allowed.includes(byName[prev].type)) {
        merged[key] = prev;
        return;
      }
      if (guessed[key] && byName[guessed[key]] && allowed.includes(byName[guessed[key]].type)) {
        merged[key] = guessed[key];
      }
    });
    const extraOk = extraCandidates(schema, merged).map((p) => p.name);
    const prevExtra = Array.isArray(saved && saved.extra) ? saved.extra : [];
    merged.extra = prevExtra.filter((name) => extraOk.includes(name));
    const names = listed.map((p) => p.name);
    const useSaved = !!(saved && saved.orderCustom);
    merged.order = resolveOrder(
      {
        ...merged,
        order: useSaved && Array.isArray(saved.order) ? saved.order : []
      },
      names
    );
    merged.orderCustom = useSaved;
    merged.badgeColorMap = saved && typeof saved.badgeColorMap === "object" ? saved.badgeColorMap : {};
    merged.hiddenRoles = Array.isArray(saved && saved.hiddenRoles) ? saved.hiddenRoles : [];
    return merged;
  }

  function defaultOrder(mapping, propertyNames) {
    const extra = Array.isArray(mapping && mapping.extra) ? mapping.extra : [];
    const extraSet = new Set(extra);
    const names = Array.isArray(propertyNames)
      ? propertyNames.filter((n) => n && !isLockProperty(n))
      : [];
    if (names.length) {
      const ids = [];
      names.forEach((name) => {
        const role = ROLE_KEYS.find((k) => mapping && mapping[k] === name);
        if (role) ids.push("role:" + role);
        else ids.push("extra:" + name);
      });
      return ids;
    }
    const ids = [];
    ROLE_KEYS.forEach((k) => {
      if (mapping && mapping[k]) ids.push("role:" + k);
    });
    extra.forEach((n) => {
      if (n) ids.push("extra:" + n);
    });
    return ids;
  }

  function resolveOrder(mapping, propertyNames) {
    const fixedIds = FIXED_ORDER_ROLES.map((role) => "role:" + role);
    const def = defaultOrder(mapping, propertyNames);
    const allowed = new Set(def);
    
    // Extra columns are anything in allowed that is not in FIXED_ORDER_ROLES
    const extraIds = def.filter((id) => !fixedIds.includes(id));
    
    // Custom saved order for extras
    const saved = Array.isArray(mapping && mapping.order) ? mapping.order : [];
    const savedExtras = saved.filter((id) => extraIds.includes(id) && allowed.has(id));
    
    // Add any remaining extras that were not in saved
    extraIds.forEach((id) => {
      if (!savedExtras.includes(id)) {
        savedExtras.push(id);
      }
    });
    
    // Return fixed order first, then extras
    return fixedIds.concat(savedExtras);
  }

  const EXTERNAL_PROCESS_TYPE = "Externo ao SEI";

  function listColumns(mapping) {
    const fields = popupFields(mapping) || [];
    const skip = new Set(["processNumber"]);
    const forced = [
      { role: "title", label: "Título" },
      { role: "status", label: "Status" },
      { role: "processType", label: "Tipo de processo" }
    ];
    if (mapping && mapping.due) {
      forced.push({ role: "due", label: "Prazo" });
    }
    const byRole = {};
    fields.forEach((f) => {
      if (f && f.role) byRole[f.role] = f;
    });
    const cols = [];
    const seen = new Set();
    forced.forEach((c) => {
      const existing = byRole[c.role];
      cols.push({
        id: existing ? existing.id : "role:" + c.role,
        kind: "role",
        role: c.role,
        name: existing ? existing.name : (mapping && mapping[c.role]) || "",
        label: c.label
      });
      seen.add(c.role);
    });
    fields.forEach((f) => {
      if (!f) return;
      if (f.role && (skip.has(f.role) || seen.has(f.role))) return;
      const key = f.role || "extra:" + f.name;
      if (seen.has(key)) return;
      seen.add(key);
      cols.push({
        id: f.id,
        kind: f.kind,
        role: f.role,
        name: f.name,
        label: f.label
      });
    });
    return cols;
  }

  function formatIsoDay(value) {
    if (!value) return "";
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(value);
    return m[3] + "/" + m[2] + "/" + m[1];
  }

  function formatCellValue(value) {
    if (value == null || value === "") return "";
    if (typeof value === "boolean") return value ? "Sim" : "Não";
    if (Array.isArray(value)) {
      return value
        .map((n) => (typeof n === "string" ? n : n && n.name))
        .filter(Boolean)
        .join(", ");
    }
    return formatIsoDay(value);
  }

  function formatListCell(page, col) {
    if (!page || !col) return "";
    const role = col.role;
    if (role === "title") return String(page.title || "");
    if (role === "status") return (page.status && page.status.name) || "";
    if (role === "processType") {
      if (isInternalProcess(page.processNumber)) return EXTERNAL_PROCESS_TYPE;
      return String(page.processType || "");
    }
    if (role === "labels") return formatCellValue(page.labels);
    if (role === "assignee") return String(page.assignee || "");
    if (role === "due") return formatIsoDay(page.due);
    if (role === "seiUrl") return String(page.seiUrl || "");
    if (role === "notes") return String(page.notes || "");
    if (role === "processNumber") return String(page.processNumber || "");
    if (col.kind === "extra" && col.name) {
      return formatCellValue(page.extra && page.extra[col.name]);
    }
    return "";
  }

  function listColumnKey(col) {
    if (!col) return "";
    if (col.id) return col.id;
    if (col.role) return "role:" + col.role;
    if (col.name) return "extra:" + col.name;
    return "";
  }

  function listFilterKind(col) {
    if (!col) return "text";
    if (col.role === "status" || col.role === "processType") return "select";
    if (col.role === "due") return "date";
    return "text";
  }

  function maskDateBr(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
    return (
      digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4)
    );
  }

  function queryColumns(opts) {
    if (Array.isArray(opts.columns) && opts.columns.length) return opts.columns;
    return Object.keys(opts.fields || {}).map((id) => {
      if (id.indexOf("role:") === 0) {
        return { id, kind: "role", role: id.slice(5) };
      }
      if (id.indexOf("extra:") === 0) {
        return { id, kind: "extra", name: id.slice(6) };
      }
      return { id, role: id };
    });
  }

  function pageMatchesField(page, col, value) {
    const raw = String(value || "").trim();
    if (!raw) return true;
    const kind = listFilterKind(col);
    if (kind === "select") {
      return formatListCell(page, col) === raw;
    }
    if (kind === "date") {
      const iso = parseDateBr(raw) || dueDay(raw);
      if (!iso) return true;
      return dueDay(page.due) === iso;
    }
    return norm(formatListCell(page, col)).indexOf(norm(raw)) !== -1;
  }

  function listFilterOptions(pages, col) {
    const values = [];
    const seen = new Set();
    (Array.isArray(pages) ? pages : []).forEach((p) => {
      const v = formatListCell(p, col);
      if (!v || seen.has(v)) return;
      seen.add(v);
      values.push(v);
    });
    values.sort((a, b) => a.localeCompare(b, "pt"));
    return values;
  }

  function dueDay(value) {
    const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[0] : "";
  }

  function pageMatchesText(page, text, columns) {
    const q = norm(text);
    if (!q) return true;
    const skip = new Set(["status", "processType", "due"]);
    const cols = Array.isArray(columns) ? columns : [];
    for (let i = 0; i < cols.length; i += 1) {
      const col = cols[i];
      if (col && col.role && skip.has(col.role)) continue;
      if (norm(formatListCell(page, col)).indexOf(q) !== -1) return true;
    }
    return false;
  }

  function filterProcesses(pages, query) {
    const list = Array.isArray(pages) ? pages : [];
    const opts =
      typeof query === "string" || query == null
        ? { kind: query || "all" }
        : query || {};
    const kind = opts.kind || "all";
    let out = list.filter(Boolean);
    if (kind === "sei") {
      out = out.filter((p) => !isInternalProcess(p.processNumber));
    } else if (kind === "external") {
      out = out.filter((p) => isInternalProcess(p.processNumber));
    }
    if (opts.status) {
      out = out.filter(
        (p) => formatListCell(p, { role: "status" }) === opts.status
      );
    }
    if (opts.processType) {
      out = out.filter(
        (p) => formatListCell(p, { role: "processType" }) === opts.processType
      );
    }
    if (opts.due) {
      const iso = parseDateBr(opts.due) || dueDay(opts.due);
      if (iso) out = out.filter((p) => dueDay(p.due) === iso);
    }
    if (opts.fields) {
      const cols = queryColumns(opts);
      out = out.filter((p) =>
        cols.every((col) =>
          pageMatchesField(p, col, opts.fields[listColumnKey(col)])
        )
      );
    }
    if (opts.text) {
      out = out.filter((p) => pageMatchesText(p, opts.text, opts.columns));
    }
    return out;
  }

  function popupFields(mapping) {
    const hidden = new Set(Array.isArray(mapping && mapping.hiddenRoles) ? mapping.hiddenRoles : []);
    const labels = {
      processNumber: "Número SEI",
      title: mapping && mapping.title ? mapping.title : "Especificação",
      processType: (mapping && mapping.processType) || "Tipo de processo",
      status: (mapping && mapping.status) || "Status",
      labels: (mapping && mapping.labels) || "Marcadores",
      assignee: (mapping && mapping.assignee) || "Atribuição",
      due: (mapping && mapping.due) || "Prazo",
      seiUrl: (mapping && mapping.seiUrl) || "URL SEI",
      notes: (mapping && mapping.notes) || "Observações"
    };
    return resolveOrder(mapping)
      .map((id) => {
        if (id.indexOf("role:") === 0) {
          const role = id.slice(5);
          if (hidden.has(role)) return null;
          if (!mapping || !mapping[role]) return null;
          return { id, kind: "role", role, name: mapping[role], label: labels[role] || role };
        }
        if (id.indexOf("extra:") === 0) {
          const name = id.slice(6);
          if (extraNames(mapping).indexOf(name) === -1) return null;
          return { id, kind: "extra", role: null, name, label: name };
        }
        return null;
      })
      .filter(Boolean);
  }

  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function listProperties(schema) {
    const props = schema && schema.properties ? schema.properties : {};
    const fromApi = Array.isArray(schema && schema.propertyOrder)
      ? schema.propertyOrder.filter((name) => props[name])
      : [];
    const keys = fromApi.length ? fromApi.slice() : Object.keys(props);
    Object.keys(props).forEach((name) => {
      if (keys.indexOf(name) === -1) keys.push(name);
    });
    const listed = keys.map((name) => ({
      name,
      type: props[name].type || "",
      id: props[name].id || "",
      raw: props[name]
    }));
    const isTitle = (p) => p.type === "title" || p.id === "title";
    const title = listed.filter(isTitle);
    const rest = listed.filter((p) => !isTitle(p));
    return title.concat(rest);
  }

  function findTitleName(schema) {
    const found = listProperties(schema).find((p) => p.type === "title");
    return found ? found.name : "";
  }

  function firstColumnName(schema) {
    const listed = listProperties(schema).filter((p) => !isLockProperty(p.name));
    return listed.length ? listed[0].name : "";
  }

  function nameMatchesRole(name, role) {
    if (!role) return false;
    const n = norm(name);
    if (!n) return false;
    if (role.prepareName && n === norm(role.prepareName)) return true;
    const hints = Array.isArray(role.hints) ? role.hints : [];
    for (let i = 0; i < hints.length; i += 1) {
      const h = norm(hints[i]);
      if (!h) continue;
      if (n === h || n.indexOf(h) !== -1) return true;
    }
    return false;
  }

  function roleByKey(key) {
    return STANDARD_ROLES.find((r) => r.key === key) || null;
  }

  function hasLockProperty(schema) {
    return listProperties(schema).some((p) => isLockProperty(p.name));
  }

  function autoMap(schema) {
    const mapping = emptyMapping();
    const listed = listProperties(schema).filter((p) => !isLockProperty(p.name));
    const used = new Set();

    const titleName = findTitleName(schema);
    if (titleName) {
      mapping.title = titleName;
      used.add(titleName);
    }

    STANDARD_ROLES.forEach((role) => {
      if (mapping[role.key]) return;
      const allowed = COMPAT[role.key] || [];
      const found = listed.find((p) => {
        if (used.has(p.name)) return false;
        if (allowed.length && p.type && !allowed.includes(p.type)) return false;
        return nameMatchesRole(p.name, role);
      });
      if (found) {
        mapping[role.key] = found.name;
        used.add(found.name);
      }
    });

    if (!mapping.processNumber) {
      const allowed = COMPAT.processNumber || [];
      const fallback = listed.find(
        (p) => !used.has(p.name) && allowed.includes(p.type) && p.type !== "title"
      );
      if (fallback) {
        mapping.processNumber = fallback.name;
      } else if (titleName) {
        mapping.processNumber = titleName;
      }
    }

    mapping.order = resolveOrder(
      mapping,
      listed.map((p) => p.name)
    );
    return mapping;
  }

  function findProperty(schema, name) {
    if (!name || !schema || !schema.properties) return null;
    const props = schema.properties;
    if (props[name]) return props[name];
    const wanted = norm(name);
    const keys = Object.keys(props);
    for (let i = 0; i < keys.length; i += 1) {
      const p = props[keys[i]];
      if (!p) continue;
      if (p.name === name || p.id === name) return p;
      if (p.name && norm(p.name) === wanted) return p;
    }
    return null;
  }

  function propertyType(schema, name) {
    const p = findProperty(schema, name);
    return p && p.type ? p.type : "";
  }

  function selectOptions(schema, name) {
    const p = findProperty(schema, name);
    if (!p) return [];
    if (p.type === "select") return (p.select && p.select.options) || [];
    if (p.type === "status") return (p.status && p.status.options) || [];
    if (p.type === "multi_select")
      return (p.multi_select && p.multi_select.options) || [];
    return [];
  }

  const NUP_RE =
    /\d{4,7}\.\d{6}\/\d{4}-\d{2}|\d{2}\.\d{1,2}\.\d{6,10}-\d{1,2}/;

  function extractNup(text) {
    const m = String(text || "").match(NUP_RE);
    return m ? m[0] : "";
  }


  function normalizeNupDigits(text) {
    return String(text || "").replace(/\D/g, "");
  }

  function sameNup(a, b) {
    if (!a || !b) return false;
    const strA = String(a).trim();
    const strB = String(b).trim();
    if (strA === strB) return true;
    const x = extractNup(strA) || strA;
    const y = extractNup(strB) || strB;
    if (x === y) return true;
    const digA = normalizeNupDigits(x);
    const digB = normalizeNupDigits(y);
    if (digA && digB) {
      if (digA === digB) return true;
      if (digA.replace(/^0+/, "") === digB.replace(/^0+/, "")) return true;
    }
    return false;
  }

  function richPlain(items) {
    return (items || []).map((t) => t.plain_text || "").join("");
  }

  function readProp(page, name) {
    if (!name || !page || !page.properties) return null;
    return page.properties[name] || null;
  }

  function readText(prop) {
    if (!prop) return "";
    if (prop.type === "title") return richPlain(prop.title);
    if (prop.type === "rich_text") return richPlain(prop.rich_text);
    if (prop.type === "url") return prop.url || "";
    return "";
  }

  function hrefFromRich(items) {
    const list = items || [];
    for (let i = 0; i < list.length; i += 1) {
      const t = list[i];
      const href =
        (t && t.href) ||
        (t && t.text && t.text.link && t.text.link.url) ||
        "";
      if (href) return String(href);
    }
    return "";
  }

  function readUrl(prop) {
    if (!prop) return "";
    if (prop.type === "url") return prop.url || "";
    if (prop.type === "rich_text") {
      return hrefFromRich(prop.rich_text) || richPlain(prop.rich_text);
    }
    if (prop.type === "title") {
      return hrefFromRich(prop.title) || richPlain(prop.title);
    }
    return readText(prop);
  }

  function seiUrlPayload(type, url) {
    const href = String(url || "").trim();
    if (!href) {
      if (type === "url") return { url: null };
      return { rich_text: [] };
    }
    if (type === "url") return { url: href };
    return {
      rich_text: [
        {
          type: "text",
          text: { content: SEI_URL_LINK_TEXT, link: { url: href } }
        }
      ]
    };
  }

  function summarizePage(page, mapping) {
    const title = readText(readProp(page, mapping.title));
    const notes = readText(readProp(page, mapping.notes));
    const rawNumber = readText(readProp(page, mapping.processNumber)) || "";
    const processNumber =
      extractNup(rawNumber) || extractNup(title) || extractNup(notes) || rawNumber;
    const urlProp = readProp(page, mapping.seiUrl);
    const seiUrl = readUrl(urlProp);

    const statusProp = readProp(page, mapping.status);
    let status = null;
    if (statusProp) {
      if (statusProp.type === "status" && statusProp.status) {
        status = {
          name: statusProp.status.name,
          color: statusProp.status.color || "default"
        };
      } else if (statusProp.type === "select" && statusProp.select) {
        status = {
          name: statusProp.select.name,
          color: statusProp.select.color || "default"
        };
      } else if (statusProp.type === "rich_text") {
        const txt = readText(statusProp);
        if (txt) {
          status = {
            name: txt,
            color: "default"
          };
        }
      }
    }

    const labelsProp = readProp(page, mapping.labels);
    let labels = [];
    if (labelsProp) {
      if (labelsProp.type === "multi_select") {
        labels = (labelsProp.multi_select || []).map((t) => ({
          name: t.name,
          color: t.color || "default"
        }));
      } else if (labelsProp.type === "rich_text") {
        const txt = readText(labelsProp);
        labels = txt
          ? txt.split(/,\s*/).map((name) => ({ name, color: "default" }))
          : [];
      }
    }

    const dueProp = readProp(page, mapping.due);
    const due =
      dueProp && dueProp.type === "date" && dueProp.date
        ? dueProp.date.start || null
        : null;

    const assigneeRaw = readExtraValue(readProp(page, mapping.assignee));
    const assignee =
      assigneeRaw == null || assigneeRaw === ""
        ? ""
        : Array.isArray(assigneeRaw)
          ? assigneeRaw
              .join(", ")
              .replace(/^[\s:.\-–—]+/, "")
              .replace(/^(?:para|a)\s+/i, "")
              .trim()
          : String(assigneeRaw)
              .replace(/^[\s:.\-–—]+/, "")
              .replace(/^(?:para|a)\s+/i, "")
              .trim();

    const extra = {};
    (Array.isArray(mapping.extra) ? mapping.extra : []).forEach((name) => {
      extra[name] = readExtraValue(readProp(page, name));
    });

    return {
      pageId: page.id,
      url: page.url || "",
      title: title || processNumber,
      processNumber,
      notes,
      seiUrl,
      status,
      labels,
      assignee,
      processType: (function () {
        const raw = readExtraValue(readProp(page, mapping.processType));
        if (raw == null || raw === "") return "";
        return Array.isArray(raw) ? raw.join(", ") : String(raw);
      })(),
      due,
      extra,
      lock: parseLock(readText(readProp(page, LOCK_PROPERTY)))
    };
  }

  function readExtraValue(prop) {
    if (!prop) return null;
    if (prop.type === "rich_text") return richPlain(prop.rich_text);
    if (prop.type === "url") return prop.url || "";
    if (prop.type === "select") return prop.select ? prop.select.name : "";
    if (prop.type === "status") return prop.status ? prop.status.name : "";
    if (prop.type === "date") return prop.date ? prop.date.start || "" : "";
    if (prop.type === "checkbox") return !!prop.checkbox;
    if (prop.type === "number") return prop.number;
    if (prop.type === "multi_select")
      return (prop.multi_select || []).map((t) => t.name);
    if (prop.type === "email") return prop.email || "";
    if (prop.type === "phone_number") return prop.phone_number || "";
    if (prop.type === "people")
      return (prop.people || [])
        .map((u) => u.name || u.id || "")
        .filter(Boolean)
        .join(", ");
    return null;
  }

  function parseDateBr(value) {
    const s = String(value || "").trim();
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const y = Number(iso[1]);
      const mo = Number(iso[2]);
      const d = Number(iso[3]);
      const dt = new Date(y, mo - 1, d);
      if (
        dt.getFullYear() !== y ||
        dt.getMonth() !== mo - 1 ||
        dt.getDate() !== d
      ) {
        return null;
      }
      return iso[1] + "-" + iso[2] + "-" + iso[3];
    }
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!br) return null;
    const d = Number(br[1]);
    const mo = Number(br[2]);
    const y = Number(br[3]);
    const dt = new Date(y, mo - 1, d);
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== mo - 1 ||
      dt.getDate() !== d
    ) {
      return null;
    }
    return (
      String(y) +
      "-" +
      String(mo).padStart(2, "0") +
      "-" +
      String(d).padStart(2, "0")
    );
  }

  function toIsoDay(value) {
    return parseDateBr(value) || "";
  }

  function asText(value) {
    if (value == null) return "";
    if (Array.isArray(value)) {
      return value
        .map((n) => (typeof n === "string" ? n : n && n.name))
        .filter(Boolean)
        .join(", ");
    }
    return String(value);
  }

  function asNames(value) {
    if (Array.isArray(value)) {
      return value
        .map((n) => (typeof n === "string" ? n : n && n.name))
        .filter(Boolean);
    }
    const t = String(value || "").trim();
    return t ? [t] : [];
  }

  function writeExtraPayload(type, value) {
    if (type === "title") {
      const content = asText(value).slice(0, 2000);
      return { title: [{ type: "text", text: { content } }] };
    }
    if (type === "rich_text") {
      const content = asText(value).slice(0, 2000);
      return {
        rich_text: content ? [{ type: "text", text: { content } }] : []
      };
    }
    if (type === "url") return { url: asText(value) || null };
    if (type === "select") {
      const name = asNames(value)[0] || "";
      return { select: name ? { name } : null };
    }
    if (type === "status") {
      const name = asNames(value)[0] || "";
      return { status: name ? { name } : null };
    }
    if (type === "date") {
      const day = toIsoDay(value);
      return { date: day ? { start: day } : null };
    }
    if (type === "checkbox") return { checkbox: !!value };
    if (type === "number") {
      if (value === "" || value == null) return { number: null };
      const n = Number(value);
      return { number: Number.isFinite(n) ? n : null };
    }
    if (type === "multi_select") {
      return {
        multi_select: asNames(value).map((name) => ({ name }))
      };
    }
    if (type === "email") return { email: asText(value) || null };
    if (type === "phone_number") return { phone_number: asText(value) || null };
    if (type === "people") {
      if (!value) return { people: [] };
      const id = typeof value === "string" ? value : value.id;
      return { people: id ? [{ id }] : [] };
    }
    return null;
  }

  function writeProperties(mapping, types, data) {
    const props = {};
    mapping = mapping || {};
    types = types || {};
    data = data || {};
    const titleName = mapping.title;
    function textPayload(type, value) {
      const content = asText(value).slice(0, 2000);
      if (type === "title") {
        return { title: [{ type: "text", text: { content } }] };
      }
      if (type === "url") return { url: content || null };
      return { rich_text: content ? [{ type: "text", text: { content } }] : [] };
    }

    function put(column, type, value, fallback) {
      if (!column) return;
      const kind = type || fallback || "rich_text";
      const payload =
        writeExtraPayload(kind, value) || textPayload(kind, value);
      if (payload) props[column] = payload;
    }

    if (titleName && "name" in data) {
      let titleText = data.name || data.processNumber || "";
      if (
        mapping.processNumber === titleName &&
        data.processNumber &&
        String(titleText).indexOf(data.processNumber) === -1
      ) {
        titleText = data.processNumber + (data.name ? " — " + data.name : "");
      }
      const kind = types.title || "title";
      props[titleName] = textPayload(kind, titleText);
      const nativeTitle = types._titleColumn;
      if (nativeTitle && nativeTitle !== titleName && kind !== "title") {
        props[nativeTitle] = textPayload("title", titleText);
      }
    } else if (types._titleColumn && "name" in data) {
      props[types._titleColumn] = textPayload(
        "title",
        data.name || data.processNumber || ""
      );
    }

    if (mapping.processNumber && mapping.processNumber !== titleName) {
      const nupType =
        types.processNumber ||
        (types._titleColumn === mapping.processNumber ? "title" : "") ||
        "rich_text";
      if (data.processNumber) {
        put(mapping.processNumber, nupType, data.processNumber, nupType);
      } else if ("processNumber" in data) {
        put(mapping.processNumber, nupType, "", nupType);
      }
    }

    if (mapping.notes && "description" in data && data.description !== undefined) {
      put(mapping.notes, types.notes, data.description, "rich_text");
    }

    if (mapping.seiUrl && data.seiUrl) {
      const kind = types.seiUrl || "rich_text";
      const payload = seiUrlPayload(kind, data.seiUrl);
      if (payload) props[mapping.seiUrl] = payload;
    }

    if (mapping.status && "statusName" in data && data.statusName !== undefined) {
      put(
        mapping.status,
        types.status || "select",
        data.statusName
      );
    }

    if (mapping.labels && Array.isArray(data.labels)) {
      put(
        mapping.labels,
        types.labels || "multi_select",
        data.labels,
        "rich_text"
      );
    }

    if (mapping.due && "due" in data) {
      put(mapping.due, types.due || "date", data.due, "date");
    }

    if (mapping.assignee && "assignee" in data) {
      put(
        mapping.assignee,
        types.assignee || "rich_text",
        data.assignee,
        "rich_text"
      );
    }

    if (mapping.processType && "processType" in data) {
      put(
        mapping.processType,
        types.processType || "rich_text",
        data.processType,
        "rich_text"
      );
    }

    if (data.extra && typeof data.extra === "object") {
      const defs = Array.isArray(data.extraFields) ? data.extraFields : [];
      defs.forEach((field) => {
        if (!field || !field.name || !(field.name in data.extra)) return;
        put(field.name, field.type, data.extra[field.name], field.type);
      });
    }

    if ("lock" in data) {
      const text = data.lock ? encodeLock(data.lock) : "";
      props[LOCK_PROPERTY] = {
        rich_text: text ? [{ type: "text", text: { content: text } }] : []
      };
    }

    return props;
  }

  function mappingTypes(schema, mapping) {
    const types = {};
    for (const key of Object.keys(mapping)) {
      if (key === "extra" || key === "order" || key === "orderCustom") continue;
      types[key] = propertyType(schema, mapping[key]);
    }
    types._titleColumn = findTitleName(schema);
    return types;
  }

  function missingPrepared(schema) {
    const existing = new Set(
      listProperties(schema).map((p) => norm(p.name))
    );
    return Object.keys(PREPARE_PROPERTIES).filter(
      (name) => !existing.has(norm(name))
    );
  }

  function processNumberEmptyFilter(mapping, types) {
    if (!mapping || !mapping.processNumber) return null;
    const type = (types && types.processNumber) || "rich_text";
    const field =
      type === "title" ? "title" : type === "url" ? "url" : "rich_text";
    return {
      property: mapping.processNumber,
      [field]: { is_empty: true }
    };
  }

  function isInternalProcess(processNumber) {
    return !extractNup(processNumber);
  }

  function findPage(pages, ref) {
    const list = Array.isArray(pages) ? pages : [];
    if (!ref) return null;
    const nup = String(ref.processNumber || "").trim();
    if (nup) {
      return list.find((p) => sameNup(p.processNumber, nup)) || null;
    }
    const pageId = String(ref.pageId || "").trim();
    if (!pageId) return null;
    return list.find((p) => p && p.pageId === pageId) || null;
  }

  function popupKey(ref) {
    if (!ref) return "";
    const nup = String(ref.processNumber || "").trim();
    if (nup) return "nup:" + nup;
    const pageId = String(
      ref.pageId || (ref.page && ref.page.pageId) || ""
    ).trim();
    if (pageId) return "id:" + pageId;
    if (ref.internal) return "internal-new";
    return "";
  }

  function processNumberFilter(mapping, types, numbers) {
    const unique = [...new Set(numbers.filter(Boolean))];
    if (!unique.length || !mapping.processNumber) return null;
    const type = types.processNumber || "rich_text";
    const field =
      type === "title" ? "title" : type === "url" ? "url" : "rich_text";

    if (unique.length === 1) {
      const n = unique[0];
      const parts = [
        { property: mapping.processNumber, [field]: { equals: n } },
        { property: mapping.processNumber, [field]: { contains: n } }
      ];
      if (mapping.title && mapping.title !== mapping.processNumber) {
        parts.push({ property: mapping.title, title: { contains: n } });
      }
      return { or: parts };
    }

    return {
      or: unique.map((n) => ({
        property: mapping.processNumber,
        [field]: { contains: n }
      }))
    };
  }

  function normTemplateKey(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function matchTemplate(templates, processType) {
    const list = Array.isArray(templates) ? templates : [];
    const q = normTemplateKey(processType);
    if (!q || !list.length) return null;
    let best = null;
    let bestScore = 0;
    for (let i = 0; i < list.length; i += 1) {
      const t = list[i];
      const n = normTemplateKey(t && t.name);
      if (!n) continue;
      let score = 0;
      if (n === q) score = 4;
      else if (q.indexOf(n) !== -1 || n.indexOf(q) !== -1) score = 3;
      else {
        const qt = q.split(" ").filter((w) => w.length >= 3);
        const nt = n.split(" ").filter((w) => w.length >= 3);
        let hits = 0;
        for (let j = 0; j < nt.length; j += 1) {
          for (let k = 0; k < qt.length; k += 1) {
            if (nt[j] === qt[k] || nt[j].indexOf(qt[k]) !== -1 || qt[k].indexOf(nt[j]) !== -1) {
              hits += 1;
              break;
            }
          }
        }
        if (hits) score = hits >= 2 ? 2 : 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return bestScore >= 1 ? best : null;
  }

  const ACTIVITIES_ROLES = [
    { key: "title", label: "Título da Atividade", required: true, types: ["title"] },
    { key: "status", label: "Status (Colunas Kanban)", required: true, types: ["status", "select"] },
    { key: "processRelation", label: "Número SEI", required: true, types: ["relation"] },
    { key: "assignee", label: "Atribuição", required: false, types: ["people", "rich_text"] },
    { key: "due", label: "Prazo", required: false, types: ["date"] }
  ];

  function findRelationProperty(schema, targetDatabaseId) {
    const props = listProperties(schema);
    const normTarget = targetDatabaseId
      ? String(targetDatabaseId).replace(/-/g, "").toLowerCase()
      : "";
    const matches = [];
    for (const p of props) {
      if (p.type !== "relation") continue;
      const relDb =
        p.relation && p.relation.database_id
          ? String(p.relation.database_id).replace(/-/g, "").toLowerCase()
          : "";
      if (!normTarget || relDb === normTarget) {
        matches.push(p);
      }
    }
    const preferred = matches.find((p) => norm(p.name) === "numero sei");
    if (preferred) return preferred.name;
    return matches.length ? matches[0].name : "";
  }

  function autoMapActivities(schema, processDatabaseId) {
    const props = listProperties(schema);
    const titleProp = findTitleName(schema);
    let statusProp = "";
    let relProp = findRelationProperty(schema, processDatabaseId);
    let assigneeProp = "";
    let dueProp = "";

    for (const p of props) {
      const n = norm(p.name);
      if (!statusProp && (p.type === "status" || p.type === "select")) {
        if (/status|situa|fase|etapa|coluna|quadro|kanban/i.test(n)) {
          statusProp = p.name;
        } else if (!statusProp && p.type === "status") {
          statusProp = p.name;
        }
      }
      if (p.type === "relation") {
        if (n === "numero sei") relProp = p.name;
        else if (!relProp) relProp = p.name;
      }
      if (!assigneeProp && (p.type === "people" || p.type === "rich_text") && /atrib|resp|pessoa|user|membro/i.test(n)) {
        assigneeProp = p.name;
      }
      if (!dueProp && p.type === "date" && /prazo|venc|due|data|limite/i.test(n)) {
        dueProp = p.name;
      }
    }
    if (!statusProp) {
      const firstStatus = props.find((p) => p.type === "status" || p.type === "select");
      if (firstStatus) statusProp = firstStatus.name;
    }

    return {
      title: titleProp || "",
      status: statusProp || "",
      processRelation: relProp || "",
      assignee: assigneeProp || "",
      due: dueProp || ""
    };
  }

  function extractStatusColumns(schema, statusPropName) {
    if (!schema) return [];
    let prop = statusPropName ? findProperty(schema, statusPropName) : null;
    if (!prop) {
      const props = listProperties(schema);
      prop = props.find((p) => p.type === "status") || props.find((p) => p.type === "select");
    }
    if (!prop) return [];
    if (prop.type === "status" && prop.status && Array.isArray(prop.status.options)) {
      return prop.status.options.map((o) => ({
        id: o.id || o.name,
        name: o.name,
        color: o.color || "default"
      }));
    }
    if (prop.type === "select" && prop.select && Array.isArray(prop.select.options)) {
      return prop.select.options.map((o) => ({
        id: o.id || o.name,
        name: o.name,
        color: o.color || "default"
      }));
    }
    return [];
  }

  function summarizeActivity(page, mapping) {
    if (!page || typeof page !== "object") return null;
    const props = page.properties || {};
    const map = mapping || {};

    const titleProp = map.title ? props[map.title] : null;
    let title = "";
    if (titleProp) {
      title = readText(titleProp);
    }
    if (!title) {
      for (const k of Object.keys(props)) {
        if (props[k] && props[k].type === "title") {
          title = readText(props[k]);
          break;
        }
      }
    }

    let statusName = "";
    let statusColor = "default";
    const statusProp = map.status ? props[map.status] : null;
    if (statusProp) {
      if (statusProp.type === "status" && statusProp.status) {
        statusName = statusProp.status.name || "";
        statusColor = statusProp.status.color || "default";
      } else if (statusProp.type === "select" && statusProp.select) {
        statusName = statusProp.select.name || "";
        statusColor = statusProp.select.color || "default";
      } else if (statusProp.type === "rich_text") {
        statusName = readText(statusProp) || "";
      }
    }

    const relProp = map.processRelation ? props[map.processRelation] : null;
    let processPageIds = [];
    if (relProp && Array.isArray(relProp.relation)) {
      processPageIds = relProp.relation.map((r) => r.id).filter(Boolean);
    }

    let assignee = "";
    const assProp = map.assignee ? props[map.assignee] : null;
    if (assProp) {
      const rawAss = readExtraValue(assProp);
      assignee = rawAss != null ? String(rawAss) : "";
    }

    let due = "";
    const dueProp = map.due ? props[map.due] : null;
    if (dueProp && dueProp.type === "date" && dueProp.date) {
      due = dueProp.date.start || "";
    }

    const sortIndex = readActivitySortIndex(props);

    return {
      activityId: page.id,
      url: page.url || "",
      title: title || "Sem título",
      statusName,
      statusColor,
      processPageIds,
      assignee,
      due,
      createdTime: page.created_time || "",
      sortIndex,
      checklist: [],
      todoCount: 0,
      todoCompleted: 0
    };
  }

  function isOrderPropertyName(name) {
    const n = String(name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    return /^(ordem|order|sort|indice|index|#)$/.test(n) || /(^| )(ordem|order|sort)($| )/.test(n);
  }

  function findActivityOrderProperty(schema) {
    const props = (schema && schema.properties) || {};
    const names = Object.keys(props);
    const exact = names.find((name) => {
      const p = props[name];
      return p && p.type === "number" && isOrderPropertyName(name);
    });
    return exact || "";
  }

  function readActivitySortIndex(props) {
    if (!props || typeof props !== "object") return null;
    const names = Object.keys(props);
    for (let i = 0; i < names.length; i += 1) {
      const name = names[i];
      const prop = props[name];
      if (!prop || prop.type !== "number") continue;
      if (!isOrderPropertyName(name)) continue;
      if (typeof prop.number === "number" && Number.isFinite(prop.number)) {
        return prop.number;
      }
    }
    return null;
  }

  function sortActivities(list) {
    return (Array.isArray(list) ? list.slice() : []).sort((a, b) => {
      const ia = a && typeof a.sortIndex === "number" ? a.sortIndex : null;
      const ib = b && typeof b.sortIndex === "number" ? b.sortIndex : null;
      if (ia != null && ib != null && ia !== ib) return ia - ib;
      if (ia != null && ib == null) return -1;
      if (ia == null && ib != null) return 1;
      const ta = Date.parse((a && a.createdTime) || "") || 0;
      const tb = Date.parse((b && b.createdTime) || "") || 0;
      if (ta !== tb) return ta - tb;
      return String((a && a.activityId) || "").localeCompare(
        String((b && b.activityId) || "")
      );
    });
  }

  root.SeiNotionSchema = {
    COMPAT,
    STANDARD_ROLES,
    FIXED_ORDER_ROLES,
    PREPARE_PROPERTIES,
    ACTIVITIES_ROLES,
    EXTRA_TYPES,
    ROLE_KEYS,
    SEI_READONLY_ROLES,
    emptyMapping,
    extraCandidates,
    extraNames,
    extraFieldDefs,
    defaultOrder,
    resolveOrder,
    popupFields,
    listColumns,
    formatListCell,
    listColumnKey,
    listFilterKind,
    maskDateBr,
    listFilterOptions,
    filterProcesses,
    EXTERNAL_PROCESS_TYPE,
    mergeMapping,
    listProperties,
    findProperty,
    findTitleName,
    firstColumnName,
    autoMap,
    autoMapActivities,
    findRelationProperty,
    extractStatusColumns,
    summarizeActivity,
    sortActivities,
    findActivityOrderProperty,
    readActivitySortIndex,
    propertyType,
    selectOptions,
    extractNup,
    sameNup,
    summarizePage,
    writeProperties,
    parseDateBr,
    mappingTypes,
    missingPrepared,
    processNumberFilter,
    processNumberEmptyFilter,
    isInternalProcess,
    findPage,
    popupKey,
    matchTemplate,
    LOCK_PROPERTY,
    LOCK_TTL_MS,
    SEI_URL_LINK_TEXT,
    isLockProperty,
    hasLockProperty,
    nameMatchesRole,
    roleByKey,
    parseLock,
    encodeLock,
    lockIsActive,
    lockHeldByOther,
    makeLock,
    badgeBusyNup,
    popupCloseIntent
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
