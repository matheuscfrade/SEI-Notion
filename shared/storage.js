/**
 * Preferências e token do Notion — só no navegador da pessoa.
 */
(function (root) {
  const KEYS = {
    SETTINGS: "seiNotion_settings",
    TOKEN: "seiNotion_token",
    SEEDED: "seiNotion_seeded",
    LAST_REGISTER_ERROR: "seiNotion_lastRegisterError"
  };

  const DEFAULT_SETTINGS = {
    seiSites: [],
    dataSourceId: "",
    dataSourceTitle: "",
    dataSourceUrl: "",
    activitiesDataSourceId: "",
    activitiesDataSourceTitle: "",
    activitiesDataSourceUrl: "",
    editorId: "",
    editorName: "",
    mapping: {
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
    },
    activitiesMapping: {
      title: "",
      status: "",
      processRelation: "",
      assignee: "",
      due: ""
    },
    activitiesColumnOrder: [],
    processDisplay: "popup",
    processPanelHeight: 0
  };

  function clampPanelHeight(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(720, Math.max(220, Math.round(n)));
  }

  function mergeSettings(raw) {
    const prev = raw && typeof raw === "object" ? raw : {};
    const prevMap = prev.mapping && typeof prev.mapping === "object" ? prev.mapping : {};
    const prevActMap = prev.activitiesMapping && typeof prev.activitiesMapping === "object" ? prev.activitiesMapping : {};
    const mapping = {
      ...DEFAULT_SETTINGS.mapping,
      ...prevMap,
      extra: Array.isArray(prevMap.extra) ? prevMap.extra.filter(Boolean) : [],
      order: Array.isArray(prevMap.order) ? prevMap.order.filter(Boolean) : [],
      orderCustom: !!prevMap.orderCustom,
      badgeColorMap: prevMap.badgeColorMap && typeof prevMap.badgeColorMap === "object" ? prevMap.badgeColorMap : {},
      hiddenRoles: Array.isArray(prevMap.hiddenRoles) ? prevMap.hiddenRoles.filter(Boolean) : []
    };
    const activitiesMapping = {
      ...DEFAULT_SETTINGS.activitiesMapping,
      ...prevActMap
    };
    return {
      ...DEFAULT_SETTINGS,
      ...prev,
      seiSites: Array.isArray(prev.seiSites) ? prev.seiSites : [],
      editorId: String(prev.editorId || ""),
      editorName: String(prev.editorName || ""),
      mapping,
      activitiesMapping,
      activitiesColumnOrder: Array.isArray(prev.activitiesColumnOrder) ? prev.activitiesColumnOrder.filter(Boolean) : [],
      processDisplay: "popup",
      processPanelHeight: clampPanelHeight(prev.processPanelHeight)
    };
  }

  function newEditorId() {
    try {
      if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (_) {
      /* ignore */
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async function ensureSeeded() {
    const data = await chrome.storage.local.get([KEYS.SEEDED, KEYS.SETTINGS]);
    const settings = mergeSettings(data[KEYS.SETTINGS]);
    if (!settings.editorId) settings.editorId = newEditorId();
    await chrome.storage.local.set({
      [KEYS.SETTINGS]: settings,
      [KEYS.SEEDED]: true
    });
    return settings;
  }

  async function getSettings() {
    const data = await chrome.storage.local.get(KEYS.SETTINGS);
    return mergeSettings(data[KEYS.SETTINGS]);
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const next = mergeSettings({
      ...current,
      ...partial,
      mapping: {
        ...current.mapping,
        ...(partial && partial.mapping ? partial.mapping : {})
      },
      activitiesMapping: {
        ...current.activitiesMapping,
        ...(partial && partial.activitiesMapping ? partial.activitiesMapping : {})
      }
    });
    await chrome.storage.local.set({ [KEYS.SETTINGS]: next });
    return next;
  }

  async function clearDataSource() {
    return saveSettings({
      dataSourceId: "",
      dataSourceTitle: "",
      dataSourceUrl: "",
      mapping: {
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
        orderCustom: false
      }
    });
  }

  async function clearActivitiesDataSource() {
    return saveSettings({
      activitiesDataSourceId: "",
      activitiesDataSourceTitle: "",
      activitiesDataSourceUrl: "",
      activitiesMapping: {
        title: "",
        status: "",
        processRelation: "",
        assignee: "",
        due: ""
      }
    });
  }

  async function getToken() {
    const data = await chrome.storage.local.get(KEYS.TOKEN);
    return String(data[KEYS.TOKEN] || "").trim();
  }

  async function setToken(token) {
    const value = String(token || "").trim();
    if (value) {
      await chrome.storage.local.set({ [KEYS.TOKEN]: value });
    } else {
      await chrome.storage.local.remove(KEYS.TOKEN);
    }
    return value;
  }

  async function setLastRegisterError(msg) {
    if (msg) {
      await chrome.storage.local.set({
        [KEYS.LAST_REGISTER_ERROR]: String(msg)
      });
    } else {
      await chrome.storage.local.remove(KEYS.LAST_REGISTER_ERROR);
    }
  }

  async function getLastRegisterError() {
    const data = await chrome.storage.local.get(KEYS.LAST_REGISTER_ERROR);
    return data[KEYS.LAST_REGISTER_ERROR] || null;
  }

  function isReady(settings, token) {
    return !!(
      token &&
      settings &&
      settings.dataSourceId &&
      settings.mapping &&
      (settings.mapping.processNumber || settings.mapping.title)
    );
  }

  function isActivitiesReady(settings, token) {
    return !!(
      token &&
      settings &&
      settings.activitiesDataSourceId &&
      settings.activitiesMapping &&
      settings.activitiesMapping.title &&
      settings.activitiesMapping.status &&
      settings.activitiesMapping.processRelation
    );
  }

  root.SeiNotionStorage = {
    KEYS,
    DEFAULT_SETTINGS,
    mergeSettings,
    ensureSeeded,
    getSettings,
    saveSettings,
    clearDataSource,
    clearActivitiesDataSource,
    getToken,
    setToken,
    setLastRegisterError,
    getLastRegisterError,
    isReady,
    isActivitiesReady
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
