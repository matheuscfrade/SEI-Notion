/**
 * Service worker — hosts do SEI, content scripts e proxy da API Notion.
 */
importScripts(
  "../shared/sites.js",
  "../shared/schema.js",
  "../shared/storage.js",
  "../shared/notion.js"
);

const CONTENT_SCRIPT_ID = "sei-notion-content";
const CONTENT_JS = [
  "shared/sei-dom.js",
  "shared/schema.js",
  "content/popup.js",
  "content/process-list.js",
  "content/process-view.js",
  "content/content.js"
];
const CONTENT_CSS = ["content/content.css"];

const Storage = globalThis.SeiNotionStorage;
const Sites = globalThis.SeiNotionSites;
const Api = globalThis.SeiNotionApi;

async function setLastRegisterError(msg) {
  await Storage.setLastRegisterError(msg);
}

async function getSeiSitesFromStorage() {
  const settings = await Storage.getSettings();
  return Sites.parseSeiSites(settings.seiSites || []);
}

async function unregisterOurScripts() {
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const ours = (existing || []).filter(
      (s) => s.id === CONTENT_SCRIPT_ID || String(s.id || "").startsWith("sei-notion")
    );
    if (ours.length) {
      await chrome.scripting.unregisterContentScripts({
        ids: ours.map((s) => s.id)
      });
    }
  } catch (_) {
    try {
      await chrome.scripting.unregisterContentScripts({
        ids: [CONTENT_SCRIPT_ID]
      });
    } catch (_) {
      /* ainda não registrado */
    }
  }
}

async function registerWithBestEffort(matches) {
  const base = {
    id: CONTENT_SCRIPT_ID,
    matches,
    js: CONTENT_JS,
    css: CONTENT_CSS,
    runAt: "document_idle",
    allFrames: true,
    persistAcrossSessions: true
  };

  try {
    await chrome.scripting.registerContentScripts([
      { ...base, matchOriginAsFallback: true }
    ]);
    return { ok: true, mode: "matchOriginAsFallback" };
  } catch (err1) {
    try {
      await unregisterOurScripts();
      await chrome.scripting.registerContentScripts([base]);
      return {
        ok: true,
        mode: "basic",
        warning: err1?.message || String(err1)
      };
    } catch (err2) {
      return {
        ok: false,
        error: err2?.message || String(err2)
      };
    }
  }
}

async function syncContentScripts() {
  const sites = await getSeiSitesFromStorage();
  const patterns = sites.map((s) => s.matchPattern);
  await unregisterOurScripts();

  if (!patterns.length) {
    await setLastRegisterError(null);
    return { ok: true, registered: false, patterns: [] };
  }

  const allowed = [];
  for (const p of patterns) {
    try {
      if (await chrome.permissions.contains({ origins: [p] })) allowed.push(p);
    } catch (_) {
      /* ignore */
    }
  }

  if (!allowed.length) {
    const msg =
      "Permissão de host ainda não concedida para: " + patterns.join(", ");
    await setLastRegisterError(msg);
    return { ok: true, registered: false, patterns, error: msg };
  }

  const result = await registerWithBestEffort(allowed);
  if (!result.ok) {
    const msg = result.error || "Falha ao registrar content scripts.";
    await setLastRegisterError(msg);
    return { ok: false, registered: false, patterns: allowed, error: msg };
  }

  let registered = false;
  try {
    const list = await chrome.scripting.getRegisteredContentScripts({
      ids: [CONTENT_SCRIPT_ID]
    });
    registered = Array.isArray(list) && list.length > 0;
  } catch (_) {
    registered = false;
  }

  if (!registered) {
    const msg = "O script não aparece como registrado.";
    await setLastRegisterError(msg);
    return { ok: false, registered: false, patterns: allowed, error: msg };
  }

  await setLastRegisterError(null);
  return { ok: true, registered: true, patterns: allowed, mode: result.mode };
}

function urlMatchesPattern(url, pattern) {
  const m = String(pattern).match(/^(https?):\/\/([^/]+)(\/.*)$/i);
  if (!m) return false;
  const scheme = m[1].toLowerCase();
  const host = m[2].toLowerCase();
  const pathPat = m[3];
  if (!pathPat.endsWith("*")) return false;
  const pathPrefix = pathPat.slice(0, -1);
  if (url.protocol.replace(":", "").toLowerCase() !== scheme) return false;
  const urlHostWithPort =
    url.port &&
    !(
      (scheme === "http" && url.port === "80") ||
      (scheme === "https" && url.port === "443")
    )
      ? `${url.hostname}:${url.port}`.toLowerCase()
      : url.hostname.toLowerCase();
  if (urlHostWithPort !== host && url.hostname.toLowerCase() !== host) {
    return false;
  }
  const path = url.pathname || "/";
  if (pathPrefix === "/") return true;
  return path === pathPrefix.replace(/\/$/, "") || path.startsWith(pathPrefix);
}

async function injectIntoOpenTabs(patterns) {
  if (!patterns?.length) return { injected: 0 };
  let injected = 0;
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch (_) {
    return { injected: 0 };
  }
  for (const tab of tabs) {
    if (!tab?.id || !tab.url) continue;
    if (!/^https?:/i.test(tab.url)) continue;
    let matches = false;
    try {
      matches = patterns.some((pattern) =>
        urlMatchesPattern(new URL(tab.url), pattern)
      );
    } catch (_) {
      continue;
    }
    if (!matches) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: CONTENT_JS
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id, allFrames: true },
        files: CONTENT_CSS
      });
      injected += 1;
    } catch (_) {
      /* aba restrita */
    }
  }
  return { injected };
}

async function getSitesStatus() {
  const sites = await getSeiSitesFromStorage();
  const patterns = sites.map((s) => s.matchPattern);
  const granted = [];
  const missing = [];
  for (const p of patterns) {
    try {
      if (await chrome.permissions.contains({ origins: [p] })) granted.push(p);
      else missing.push(p);
    } catch (_) {
      missing.push(p);
    }
  }

  let registered = false;
  let registeredMatches = [];
  try {
    const list = await chrome.scripting.getRegisteredContentScripts({
      ids: [CONTENT_SCRIPT_ID]
    });
    registered = Array.isArray(list) && list.length > 0;
    if (registered) registeredMatches = list[0].matches || [];
  } catch (_) {
    registered = false;
  }

  const lastError = await Storage.getLastRegisterError();
  return {
    sites: sites.map((s) => s.baseUrl),
    patterns,
    granted,
    missing,
    registered,
    registeredMatches,
    lastError,
    active: registered && granted.length > 0 && missing.length === 0
  };
}

async function requireNotion() {
  const token = await Storage.getToken();
  const settings = await Storage.ensureSeeded();
  if (!token) {
    throw new Error("Cole o token do Notion nas opções da extensão.");
  }
  return { token, settings };
}

function fail(err) {
  return { ok: false, error: err?.message || String(err) };
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await Storage.ensureSeeded();
  await syncContentScripts().catch(() => {});
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await Storage.ensureSeeded();
  await syncContentScripts().catch(() => {});
});

chrome.permissions.onRemoved.addListener(() => {
  syncContentScripts().catch(() => {});
});
chrome.permissions.onAdded.addListener(() => {
  syncContentScripts().catch(() => {});
});

const workbenchTabs = new Map();
const WORKBENCH_TABS_KEY = "seiNotion_workbenchTabs";

async function loadWorkbenchTabs() {
  if (workbenchTabs.size) return;
  try {
    const data = await chrome.storage.session.get(WORKBENCH_TABS_KEY);
    const saved = data && data[WORKBENCH_TABS_KEY];
    if (saved && typeof saved === "object") {
      Object.keys(saved).forEach((nup) => {
        const id = Number(saved[nup]);
        if (id) workbenchTabs.set(nup, id);
      });
    }
  } catch (_) {
    /* ignore */
  }
}

async function persistWorkbenchTabs() {
  try {
    const obj = {};
    workbenchTabs.forEach((id, nup) => {
      obj[nup] = id;
    });
    await chrome.storage.session.set({ [WORKBENCH_TABS_KEY]: obj });
  } catch (_) {
    /* ignore */
  }
}

function forgetWorkbenchTab(tabId) {
  let changed = false;
  workbenchTabs.forEach((id, nup) => {
    if (id === tabId) {
      workbenchTabs.delete(nup);
      changed = true;
    }
  });
  if (changed) persistWorkbenchTabs();
}

chrome.tabs.onRemoved.addListener((tabId) => {
  forgetWorkbenchTab(tabId);
});

async function focusWorkbenchTab(tab, url, key) {
  const update = { active: true };
  try {
    const current = new URL(tab.url || "");
    if (current.searchParams.get("nup") !== key) update.url = url;
  } catch (_) {
    update.url = url;
  }
  await chrome.tabs.update(tab.id, update);
  if (tab.windowId) {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  workbenchTabs.set(key, tab.id);
  await persistWorkbenchTabs();
  return { ok: true, reused: true, tabId: tab.id };
}

async function openWorkbenchTab(nup) {
  const key = String(nup || "").trim();
  const url =
    chrome.runtime.getURL("workbench/workbench.html") +
    "?nup=" +
    encodeURIComponent(key);
  await loadWorkbenchTabs();
  const existingId = workbenchTabs.get(key);
  if (existingId) {
    try {
      const tab = await chrome.tabs.get(existingId);
      if (tab && tab.id) return focusWorkbenchTab(tab, url, key);
    } catch (_) {
      workbenchTabs.delete(key);
    }
  }
  const created = await chrome.tabs.create({ url });
  if (created && created.id) {
    workbenchTabs.set(key, created.id);
    await persistWorkbenchTabs();
  }
  return { ok: true, tabId: created && created.id };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message && message.type;

  if (type === "SEI_NOTION_OPEN_WORKBENCH") {
    const nup = String(message.processNumber || "").trim();
    if (!nup) {
      sendResponse({ ok: false, error: "Processo não informado." });
      return true;
    }
    openWorkbenchTab(nup)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_PING") {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return true;
  }

  if (type === "SEI_NOTION_SYNC_CONTENT_SCRIPTS") {
    (async () => {
      await Storage.ensureSeeded();
      const result = await syncContentScripts();
      let injected = 0;
      if (result.registered && message.injectOpenTabs !== false) {
        injected = (await injectIntoOpenTabs(result.patterns)).injected || 0;
      }
      const status = await getSitesStatus();
      sendResponse({ ...result, injected, status });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_SITES_STATUS") {
    getSitesStatus()
      .then((status) => sendResponse({ ok: true, status }))
      .catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_TEST_TOKEN") {
    (async () => {
      const token = String(message.token || "").trim();
      if (!token) throw new Error("Informe o token.");
      const me = await Api.testToken(token);
      await Storage.setToken(token);
      sendResponse({ ok: true, me, masked: token.slice(0, 8) + "…" });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_CLEAR_TOKEN") {
    Storage.setToken("")
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_LIST_DATA_SOURCES") {
    (async () => {
      const { token } = await requireNotion();
      const list = await Api.listDataSources(token);
      sendResponse({ ok: true, list });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_RESOLVE_DATA_SOURCE") {
    (async () => {
      const { token } = await requireNotion();
      const ds = await Api.resolveDataSource(token, message.input);
      const inspected = await Api.inspectDataSource(token, ds.id);
      sendResponse({ ok: true, dataSource: inspected });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_INSPECT_DATA_SOURCE") {
    (async () => {
      const { token } = await requireNotion();
      const inspected = await Api.inspectDataSource(token, message.dataSourceId);
      sendResponse({ ok: true, dataSource: inspected });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_PREPARE_DATA_SOURCE") {
    (async () => {
      const { token } = await requireNotion();
      const inspected = await Api.prepareDataSource(token, message.dataSourceId);
      sendResponse({ ok: true, dataSource: inspected });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_CONFIG_STATUS") {
    (async () => {
      const token = await Storage.getToken();
      const settings = await Storage.ensureSeeded();
      sendResponse({
        ok: true,
        hasToken: !!token,
        ready: Storage.isReady(settings, token),
        activitiesReady: Storage.isActivitiesReady(settings, token),
        dataSourceTitle: settings.dataSourceTitle || "",
        dataSourceId: settings.dataSourceId || "",
        activitiesDataSourceTitle: settings.activitiesDataSourceTitle || "",
        activitiesDataSourceId: settings.activitiesDataSourceId || "",
        mapping: settings.mapping,
        activitiesMapping: settings.activitiesMapping,
        editorId: settings.editorId || "",
        editorName: settings.editorName || "",
        processDisplay: "popup",
        processPanelHeight: Number(settings.processPanelHeight) || 0
      });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_INSPECT_ACTIVITIES_DS") {
    (async () => {
      const { token, settings } = await requireNotion();
      const inspected = await Api.inspectActivitiesDataSource(
        token,
        message.activitiesDataSourceId,
        message.processDataSourceId || settings.dataSourceId
      );
      sendResponse({ ok: true, dataSource: inspected });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_PREPARE_ACTIVITIES_DS") {
    (async () => {
      const { token, settings } = await requireNotion();
      const inspected = await Api.prepareActivitiesDataSource(
        token,
        message.activitiesDataSourceId,
        message.processDataSourceId || settings.dataSourceId
      );
      sendResponse({ ok: true, dataSource: inspected });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_QUERY") {
    (async () => {
      const { token, settings } = await requireNotion();
      if (!Storage.isReady(settings, token)) {
        throw new Error(
          "Configure o banco do Notion nas opções (token + database + Número SEI)."
        );
      }
      const result = await Api.queryByProcessNumbers(
        token,
        settings,
        message.processNumbers || [],
        { light: !!message.light }
      );
      sendResponse({
        ok: true,
        pages: result.pages,
        statusOptions: result.statusOptions,
        labelOptions: result.labelOptions,
        mapping: settings.mapping,
        extraFields: result.extraFields || [],
        templates: result.templates || []
      });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_CREATE") {
    (async () => {
      const { token, settings } = await requireNotion();
      if (!Storage.isReady(settings, token)) {
        throw new Error("Notion ainda não está configurado.");
      }
      const page = await Api.createPage(token, settings, {
        processNumber: message.processNumber,
        name: message.name,
        description: message.description,
        seiUrl: message.seiUrl,
        statusName: message.statusName,
        due: message.due,
        labels: message.labels,
        assignee: message.assignee,
        processType: message.processType,
        extra: message.extra,
        extraFields: message.extraFields,
        templateId: message.templateId || "",
        checklist: message.checklist || []
      });
      sendResponse({
        ok: true,
        page,
        checklist: page && page.checklist ? page.checklist : [],
        templates: page && page.templates ? page.templates : [],
        appliedTemplate: (page && page.appliedTemplate) || ""
      });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_CHECKLIST") {
    (async () => {
      const { token, settings } = await requireNotion();
      const items = message.pageId
        ? await Api.listChecklist(token, message.pageId)
        : [];
      let templates = [];
      try {
        templates = await Api.listTemplates(token, settings.dataSourceId);
      } catch (_) {
        templates = [];
      }
      sendResponse({ ok: true, items, templates });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_APPLY_TEMPLATE") {
    (async () => {
      const { token } = await requireNotion();
      if (!message.pageId || !message.templateId) {
        throw new Error("Página ou modelo ausente.");
      }
      const items = await Api.applyTemplate(
        token,
        message.pageId,
        message.templateId,
        { erase: !!message.erase }
      );
      sendResponse({ ok: true, items });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_TOGGLE_TODO") {
    (async () => {
      const { token } = await requireNotion();
      if (!message.blockId) throw new Error("Item ausente.");
      await Api.setTodoChecked(token, message.blockId, !!message.checked);
      sendResponse({ ok: true });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_ADD_TODO") {
    (async () => {
      const { token } = await requireNotion();
      if (!message.pageId) throw new Error("Página ausente.");
      const items = await Api.appendTodos(token, message.pageId, [
        { text: message.text, checked: !!message.checked, depth: message.depth || 0 }
      ]);
      sendResponse({ ok: true, items });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_EDIT_TODO") {
    (async () => {
      const { token } = await requireNotion();
      if (!message.blockId) throw new Error("Item ausente.");
      await Api.updateTodo(token, message.blockId, { text: message.text });
      sendResponse({ ok: true });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_REMOVE_TODO") {
    (async () => {
      const { token } = await requireNotion();
      if (!message.blockId) throw new Error("Item ausente.");
      await Api.deleteBlock(token, message.blockId);
      sendResponse({ ok: true });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_QUERY_ACTIVITIES") {
    (async () => {
      const { token, settings } = await requireNotion();
      if (!message.processPageId) {
        sendResponse({ ok: true, activities: [], statusColumns: [], templates: [] });
        return;
      }
      const result = await Api.queryActivitiesByProcess(
        token,
        settings,
        message.processPageId
      );
      sendResponse({ ok: true, ...result });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_CREATE_ACTIVITY") {
    (async () => {
      const { token, settings } = await requireNotion();
      const activity = await Api.createActivity(
        token,
        settings,
        message.payload || {}
      );
      sendResponse({ ok: true, activity });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_IMPORT_ACTIVITY_TEMPLATE") {
    (async () => {
      const { token, settings } = await requireNotion();
      const activities = await Api.importActivitiesFromTemplate(
        token,
        settings,
        message.payload || {}
      );
      sendResponse({ ok: true, activities });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_UPDATE_ACTIVITY") {
    (async () => {
      const { token, settings } = await requireNotion();
      const activity = await Api.updateActivity(
        token,
        settings,
        message.payload || {}
      );
      sendResponse({ ok: true, activity });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_UPDATE_ACTIVITY_STATUS") {
    (async () => {
      const { token, settings } = await requireNotion();
      const result = await Api.updateActivityStatus(
        token,
        settings,
        message.activityPageId,
        message.statusName
      );
      sendResponse({ ok: true, ...result });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_SAVE_ACTIVITIES_COLUMN_ORDER") {
    (async () => {
      await Storage.saveSettings({
        activitiesColumnOrder: message.columnOrder || []
      });
      sendResponse({ ok: true });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_DELETE_ACTIVITY") {
    (async () => {
      const { token } = await requireNotion();
      await Api.deleteActivity(token, message.activityPageId);
      sendResponse({ ok: true });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_UPDATE") {
    (async () => {
      const { token, settings } = await requireNotion();
      const page = await Api.updatePage(
        token,
        settings,
        message.pageId,
        message.patch || {}
      );
      sendResponse({ ok: true, page });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_LOCK") {
    (async () => {
      const { token, settings } = await requireNotion();
      const result = await Api.acquireLock(token, settings, message.pageId);
      sendResponse({
        ok: true,
        held: !!result.held,
        lock: result.lock || null,
        page: result.page || null
      });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_UNLOCK") {
    (async () => {
      const { token, settings } = await requireNotion();
      const result = await Api.releaseLock(token, settings, message.pageId);
      sendResponse({ ok: true, released: !!result.released });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  if (type === "SEI_NOTION_HEARTBEAT") {
    (async () => {
      const { token, settings } = await requireNotion();
      const result = await Api.acquireLock(token, settings, message.pageId);
      sendResponse({
        ok: true,
        held: !!result.held,
        lock: result.lock || null,
        page: result.page || null
      });
    })().catch((err) => sendResponse(fail(err)));
    return true;
  }

  return false;
});

Storage.ensureSeeded()
  .then(() => syncContentScripts())
  .catch(() => {});
