/**
 * Injeta o botão Notion e o painel/popup (criar só se ainda não existir página).
 */
(function () {
  const IS_WORKBENCH =
    !!globalThis.__SEI_NOTION_WORKBENCH__ ||
    /\/workbench\/workbench\.html$/i.test(String(location.pathname || ""));
  const FLAG = "data-sei-notion";
  if (!IS_WORKBENCH) {
    if (document.documentElement.getAttribute(FLAG) === "ready") return;
    document.documentElement.setAttribute(FLAG, "ready");
  }

  const state = {
    pages: [],
    statusOptions: [],
    labelOptions: [],
    mapping: {},
    extraFields: [],
    templates: [],
    checklist: [],
    activities: [],
    activityStatusColumns: [],
    activityTemplates: [],
    activitiesConfigured: false,
    selectedTemplateId: "",
    loading: false,
    busyLabel: "",
    creating: null,
    error: null,
    editor: { id: "", name: "" },
    heldPageId: null,
    processDisplay: "popup",
    panelHeight: 0,
    seiContext: {
      labels: [],
      assignee: "",
      name: "",
      description: "",
      processType: "",
      seiUrl: "",
      due: ""
    }
  };

  let lastNumbersKey = "";
  let heartbeatTimer = null;

  function send(type, payload) {
    return chrome.runtime.sendMessage({ type, ...(payload || {}) });
  }

  function sameNup(a, b) {
    if (globalThis.SeiNotionSchema && SeiNotionSchema.sameNup) {
      return SeiNotionSchema.sameNup(a, b);
    }
    return a === b;
  }

  function pageFor(nup) {
    return (state.pages || []).find((p) => sameNup(p.processNumber, nup)) || null;
  }

  function mergePage(page) {
    if (!page) return;
    const rest = state.pages.filter((p) => p.pageId !== page.pageId);
    if (page.processNumber) {
      const withoutNup = rest.filter(
        (p) => !sameNup(p.processNumber, page.processNumber)
      );
      state.pages = [...withoutNup, page];
    } else {
      state.pages = [...rest, page];
    }
  }

  function applyFormToPage(form, page) {
    const next = { ...(page || {}) };
    if (form.processNumber) next.processNumber = form.processNumber;
    if (form.name) next.title = form.name;
    if ("description" in form) next.notes = form.description;
    if ("statusName" in form) {
      next.status = form.statusName
        ? {
            name: form.statusName,
            color: (next.status && next.status.color) || "default"
          }
        : null;
    }
    if ("due" in form) next.due = form.due;
    if (Array.isArray(form.labels)) {
      next.labels = form.labels.map((n) =>
        typeof n === "string" ? { name: n } : n
      );
    }
    if ("assignee" in form) next.assignee = form.assignee || "";
    if ("processType" in form) next.processType = form.processType || "";
    if (form.extra) next.extra = { ...(next.extra || {}), ...form.extra };
    return next;
  }

  function lockHeldByOther(lock) {
    if (globalThis.SeiNotionSchema && SeiNotionSchema.lockHeldByOther) {
      return SeiNotionSchema.lockHeldByOther(lock, state.editor.id);
    }
    return false;
  }

  function popupCtx(extra) {
    const nup = extra.processNumber;
    const page = extra.page || pageFor(nup);
    const locked = !!(page && lockHeldByOther(page.lock));
    const lockMine = !!(
      page &&
      page.lock &&
      state.editor.id &&
      page.lock.id === state.editor.id
    );

    const effectiveLabels =
      (extra.seiLabels && extra.seiLabels.length ? extra.seiLabels : null) ||
      (extra.labels && extra.labels.length ? extra.labels : null) ||
      (state.seiContext.labels && state.seiContext.labels.length ? state.seiContext.labels : null) ||
      (page && page.labels && page.labels.length ? page.labels : []) ||
      [];
    const effectiveAssignee =
      extra.seiAssignee ||
      extra.assignee ||
      state.seiContext.assignee ||
      (page && page.assignee) ||
      "";
    const effectiveDue =
      extra.seiDue ||
      extra.due ||
      state.seiContext.due ||
      (page && page.due) ||
      "";
    const effectiveDescription =
      extra.description ||
      state.seiContext.description ||
      (page && page.notes) ||
      "";
    const effectiveProcessType =
      extra.seiProcessType ||
      state.seiContext.processType ||
      extra.processType ||
      (page && page.processType) ||
      "";
    const effectiveName =
      extra.name ||
      state.seiContext.name ||
      (page && page.title) ||
      "";

    return {
      processNumber: nup,
      name: effectiveName,
      description: effectiveDescription,
      seiUrl:
        extra.seiUrl ||
        state.seiContext.seiUrl ||
        (page && page.seiUrl) ||
        (globalThis.SeiNotionDom &&
          SeiNotionDom.processUrl &&
          SeiNotionDom.processUrl(document, nup)) ||
        "",
      seiLabels: effectiveLabels,
      seiAssignee: effectiveAssignee,
      seiProcessType: effectiveProcessType,
      seiDue: effectiveDue,
      page,
      statusOptions: state.statusOptions,
      labelOptions: state.labelOptions,
      mapping: state.mapping,
      extraFields: state.extraFields,
      templates: state.templates || [],
      checklist: state.checklist || [],
      activities: state.activities || [],
      activityStatusColumns: state.activityStatusColumns || [],
      activityTemplates: state.activityTemplates || [],
      activitiesConfigured: state.activitiesConfigured,
      selectedTemplateId:
        extra.selectedTemplateId || state.selectedTemplateId || "",
      busy: state.creating === nup || !!state.loading,
      busyLabel: state.busyLabel || "Carregando dados do Notion…",
      error: state.error,
      locked,
      lockName: page && page.lock ? page.lock.name : "",
      lockMine,
      onCreate: (form) => create(form),
      onSave: (pageId, form) => update(pageId, form),
      onRetry: () => retryLock(nup),
      onSelectTemplate: (templateId, name) =>
        selectTemplate(nup, templateId, name),
      onAddTodo: (text, depth) => addTodo(nup, text, depth),
      onEditTodo: (id, text) => editTodo(nup, id, text),
      onRemoveTodo: (id) => removeTodo(nup, id),
      onToggleTodo: (blockId, checked) => toggleTodo(blockId, checked),
      onCreateActivity: (payload) => createActivity(nup, payload),
      onImportActivityTemplate: (payload) => importActivityTemplate(nup, payload),
      onUpdateActivity: (payload) => updateActivity(nup, payload),
      onMoveActivity: (activityId, statusName) => moveActivity(nup, activityId, statusName),
      onReorderColumns: (columnOrder) => reorderActivityColumns(columnOrder),
      onDeleteActivity: (activityId) => deleteActivity(nup, activityId),
      onToggleActivityTodo: (activityId, blockId, checked) =>
        toggleActivityTodo(nup, activityId, blockId, checked),
      onAddActivityTodo: (activityId, text) => addActivityTodo(nup, activityId, text),
      onDeleteActivityTodo: (activityId, blockId) =>
        deleteActivityTodo(nup, activityId, blockId),
      onEditActivityTodo: (activityId, blockId, text) =>
        editActivityTodo(nup, activityId, blockId, text),
      onClose: () => releaseHeld(),
      onCollapse: () => {
        releaseHeld().then(() => refreshPopup({ preserveForm: true }));
      },
      onEditIntent: () => requestLock(),
      onPopout: () => openWorkbench(),
      uiMode:
        extra.uiMode ||
        (IS_WORKBENCH ? "page" : usePanelOnThisPage() ? "panel" : "modal"),
      panelHeight: state.panelHeight
    };
  }

  function refreshPopup(opts) {
    if (!SeiNotionPopup.isOpen()) return;
    const nup = SeiNotionPopup.processNumber();
    const prev = (opts && opts.preserveForm !== false && SeiNotionPopup.readForm)
      ? SeiNotionPopup.readForm()
      : null;
    const page = pageFor(nup);
    SeiNotionPopup.update(
      popupCtx({
        processNumber: nup,
        page,
        name:
          (prev && prev.name) ||
          (page && page.title) ||
          state.seiContext.name ||
          "",
        seiUrl:
          (prev && prev.seiUrl) ||
          (page && page.seiUrl) ||
          state.seiContext.seiUrl ||
          "",
        seiProcessType: state.seiContext.processType || "",
        processType:
          state.seiContext.processType ||
          (prev && prev.processType) ||
          (page && page.processType) ||
          "",
        due:
          (prev && prev.due) ||
          (page && page.due) ||
          state.seiContext.due ||
          "",
        labels:
          (prev && Array.isArray(prev.labels) && prev.labels.length)
            ? prev.labels
            : (page && page.labels && page.labels.length)
              ? page.labels
              : (state.seiContext.labels || []),
        description:
          (prev && prev.description !== undefined && prev.description !== null && prev.description !== "")
            ? prev.description
            : (page && page.notes) || state.seiContext.description || "",
        assignee:
          (prev && prev.assignee) ||
          (page && page.assignee) ||
          state.seiContext.assignee ||
          ""
      }),
      { preserveForm: !opts || opts.preserveForm !== false }
    );
  }

  async function query(numbers, opts) {
    const popupOpen = SeiNotionPopup.isOpen();
    state.loading = true;
    state.busyLabel = "Carregando dados do Notion…";
    state.error = null;
    paint();
    if (popupOpen) SeiNotionPopup.setBusy(true, state.busyLabel);
    try {
      const res = await send("SEI_NOTION_QUERY", {
        processNumbers: numbers,
        light: !!(opts && opts.light)
      });
      if (!res?.ok) throw new Error(res?.error || "Falha ao consultar o Notion.");
      if (opts && opts.merge) {
        (res.pages || []).forEach(mergePage);
      } else {
        state.pages = res.pages || [];
      }
      state.statusOptions = res.statusOptions || [];
      state.labelOptions = res.labelOptions || [];
      state.mapping = res.mapping || state.mapping;
      state.extraFields = res.extraFields || [];
      if (Array.isArray(res.templates)) state.templates = res.templates;
      state.error = null;
    } catch (err) {
      state.error = err.message || String(err);
    } finally {
      if (opts && opts.keepBusy) {
        paint();
      } else {
        state.loading = false;
        paint();
        if (popupOpen) {
          SeiNotionPopup.setBusy(false);
          refreshPopup({ preserveForm: true });
        }
      }
    }
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (!state.heldPageId) {
        stopHeartbeat();
        return;
      }
      send("SEI_NOTION_HEARTBEAT", { pageId: state.heldPageId })
        .then((res) => {
          if (res && res.page) mergePage(res.page);
          if (!res || !res.held) {
            state.heldPageId = null;
            stopHeartbeat();
            refreshPopup({ preserveForm: true });
          }
        })
        .catch(() => {});
    }, 30000);
  }

  async function tryLock(page) {
    if (!page || !page.pageId) return page;
    try {
      const res = await send("SEI_NOTION_LOCK", { pageId: page.pageId });
      if (res && res.page) mergePage(res.page);
      if (res && res.held) {
        state.heldPageId = page.pageId;
        startHeartbeat();
      } else {
        if (state.heldPageId === page.pageId) state.heldPageId = null;
        stopHeartbeat();
      }
    } catch (_) {
      /* ignore */
    }
    return pageFor(page.processNumber) || page;
  }

  async function releaseHeld() {
    stopHeartbeat();
    const id = state.heldPageId;
    state.heldPageId = null;
    if (!id) return;
    try {
      await send("SEI_NOTION_UNLOCK", { pageId: id });
    } catch (_) {
      /* ignore */
    }
  }

  async function retryLock(nup) {
    await query([nup], { merge: true });
    const page = pageFor(nup);
    if (page) await tryLock(page);
    refreshPopup({ preserveForm: false });
  }

  async function loadEditor() {
    try {
      const res = await send("SEI_NOTION_CONFIG_STATUS");
      if (res && res.ok) {
        state.editor = {
          id: res.editorId || "",
          name: res.editorName || "Alguém"
        };
        state.processDisplay =
          res.processDisplay === "popup" ? "popup" : "panel";
        if (typeof res.processPanelHeight === "number") {
          state.panelHeight = res.processPanelHeight;
        }
      }
    } catch (_) {
      /* ignore */
    }
  }

  async function requestLock() {
    const nup = SeiNotionPopup.processNumber();
    const page = pageFor(nup);
    if (!page || !page.pageId) return;
    if (state.heldPageId === page.pageId) return;
    if (lockHeldByOther(page.lock)) return;
    await tryLock(page);
    refreshPopup({ preserveForm: true });
  }

  async function create(payload) {
    const existing = pageFor(payload.processNumber);
    if (existing) {
      await update(existing.pageId, payload);
      return;
    }
    state.creating = payload.processNumber;
    state.error = null;
    paint();
    SeiNotionPopup.setBusy(true, "Criando página no Notion…");
    try {
      const res = await send("SEI_NOTION_CREATE", payload);
      if (!res?.ok) throw new Error(res?.error || "Não foi possível criar a página.");
      const saved = applyFormToPage(payload, res.page);
      mergePage(saved);
      if (Array.isArray(res.templates)) state.templates = res.templates;
      state.checklist = Array.isArray(res.checklist) ? res.checklist : [];
      if (saved.pageId) {
        await tryLock(saved);
        if (!state.checklist.length) await loadChecklist(saved.pageId);
        await loadActivities(saved.pageId);
      }
      state.error = null;
    } catch (err) {
      state.error = err.message || String(err);
    } finally {
      state.creating = null;
      paint();
      SeiNotionPopup.setBusy(false);
      refreshPopup({ preserveForm: false });
    }
  }

  async function update(pageId, patch) {
    await requestLock();
    const prev = state.pages.find((p) => p.pageId === pageId);
    state.creating = (prev && prev.processNumber) || patch.processNumber || null;
    state.error = null;
    SeiNotionPopup.setBusy(true, "Salvando…");
    try {
      const res = await send("SEI_NOTION_UPDATE", {
        pageId,
        patch: {
          ...patch,
          processNumber: patch.processNumber || (prev && prev.processNumber)
        }
      });
      if (!res?.ok) throw new Error(res?.error || "Falha ao atualizar.");
      mergePage(applyFormToPage(patch, res.page || prev));
      state.error = null;
    } catch (err) {
      state.error = err.message || String(err);
    } finally {
      state.creating = null;
      paint();
      SeiNotionPopup.setBusy(false);
      refreshPopup({ preserveForm: false });
    }
  }

  function isNotionBlockId(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(id || "")
    );
  }

  function newTmpId() {
    return "tmp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  }

  async function openPopup(info, opts) {
    const options = opts || {};
    state.selectedTemplateId = "";
    state.seiContext = {
      labels: info.labels || [],
      assignee: info.assignee || "",
      name: info.name || "",
      description: info.description || "",
      processType: info.processType || state.seiContext.processType || "",
      seiUrl: info.seiUrl || state.seiContext.seiUrl || "",
      due: info.due || state.seiContext.due || ""
    };
    const nup = info.processNumber;
    const uiMode = usePanelOnThisPage() ? "panel" : "modal";
    if (
      SeiNotionPopup.isOpen() &&
      SeiNotionPopup.processNumber() &&
      SeiNotionPopup.processNumber() !== nup
    ) {
      await releaseHeld();
    }
    const ctx = popupCtx({ ...info, uiMode });
    if (SeiNotionPopup.isOpen() && SeiNotionPopup.processNumber() === nup) {
      if (uiMode === "panel" && SeiNotionPopup.reveal) SeiNotionPopup.reveal();
      SeiNotionPopup.update(ctx, { preserveForm: true });
      if (!options.forceFetch) return;
    } else {
      state.loading = true;
      state.busyLabel = "Carregando dados do Notion…";
      SeiNotionPopup.open(popupCtx({ ...info, uiMode }));
    }
    if (uiMode === "panel") scheduleSeiContextRefresh();
    if (options.skipFetch) return;
    if (SeiNotionPopup.isOpen()) {
      SeiNotionPopup.setBusy(true, "Carregando dados do Notion…");
    }
    await query([nup], { merge: true, keepBusy: true });
    const page = pageFor(nup);
    if (page && page.pageId) {
      if (uiMode !== "panel") await tryLock(page);
      if (SeiNotionPopup.isOpen()) {
        SeiNotionPopup.setBusy(true, "Carregando atividades…");
      }
      await Promise.all([
        loadChecklist(page.pageId),
        loadActivities(page.pageId)
      ]);
    } else {
      state.checklist = [];
      state.activities = [];
    }
    state.loading = false;
    state.busyLabel = "";
    if (SeiNotionPopup.isOpen()) SeiNotionPopup.setBusy(false);
    refreshPopup({ preserveForm: false });
  }

  async function loadActivities(pageId) {
    if (!pageId) {
      state.activities = [];
      state.activityStatusColumns = [];
      state.activityTemplates = [];
      state.activitiesConfigured = false;
      return;
    }
    try {
      const res = await send("SEI_NOTION_QUERY_ACTIVITIES", { processPageId: pageId });
      if (res && res.ok) {
        state.activities = res.activities || [];
        state.activityStatusColumns = res.statusColumns || [];
        state.activityTemplates = res.templates || [];
        state.activitiesConfigured = true;
      }
    } catch (_) {
      state.activities = [];
      state.activitiesConfigured = false;
    }
  }

  async function createActivity(nup, payload) {
    const page = pageFor(nup);
    if (!page || !page.pageId) return;
    state.error = null;
    SeiNotionPopup.setBusy(true, "Criando atividade…");
    try {
      const res = await send("SEI_NOTION_CREATE_ACTIVITY", {
        payload: {
          processPageId: page.pageId,
          ...payload
        }
      });
      if (!res?.ok) throw new Error(res?.error || "Falha ao criar atividade.");
      if (res.activity) {
        state.activities = [res.activity, ...(state.activities || [])];
      }
    } catch (err) {
      state.error = err.message || String(err);
    } finally {
      SeiNotionPopup.setBusy(false);
      refreshPopup({ preserveForm: true });
    }
  }

  async function importActivityTemplate(nup, payload) {
    const page = pageFor(nup);
    if (!page || !page.pageId || !payload || !payload.templateId) return;
    state.error = null;
    SeiNotionPopup.setBusy(true, "Importando modelo…");
    try {
      const res = await send("SEI_NOTION_IMPORT_ACTIVITY_TEMPLATE", {
        payload: {
          processPageId: page.pageId,
          ...payload
        }
      });
      if (!res?.ok) throw new Error(res?.error || "Falha ao importar modelo de atividades.");
      if (Array.isArray(res.activities) && res.activities.length) {
        const imported = res.activities.map((a, i) =>
          a ? { ...a, sortIndex: typeof a.sortIndex === "number" ? a.sortIndex : i } : a
        );
        const importedIds = new Set(
          imported.map((a) => a && a.activityId).filter(Boolean)
        );
        const rest = (state.activities || []).filter(
          (a) => !importedIds.has(a.activityId)
        );
        const sort =
          globalThis.SeiNotionSchema && SeiNotionSchema.sortActivities
            ? SeiNotionSchema.sortActivities
            : (list) => list;
        state.activities = sort(imported.concat(rest));
      }
    } catch (err) {
      state.error = err.message || String(err);
    } finally {
      SeiNotionPopup.setBusy(false);
      refreshPopup({ preserveForm: true });
    }
  }

  async function updateActivity(nup, payload) {
    if (!payload || !payload.activityId) return;
    state.error = null;
    SeiNotionPopup.setBusy(true, "Salvando atividade…");
    try {
      const res = await send("SEI_NOTION_UPDATE_ACTIVITY", { payload });
      if (!res?.ok) throw new Error(res?.error || "Falha ao atualizar atividade.");
      if (res.activity) {
        state.activities = (state.activities || []).map((a) =>
          a.activityId === res.activity.activityId ? { ...a, ...res.activity } : a
        );
      }
    } catch (err) {
      state.error = err.message || String(err);
    } finally {
      SeiNotionPopup.setBusy(false);
      refreshPopup({ preserveForm: true });
    }
  }

  async function reorderActivityColumns(columnOrder) {
    if (!Array.isArray(columnOrder) || !columnOrder.length) return;
    const orderMap = new Map();
    columnOrder.forEach((name, idx) => orderMap.set(name, idx));
    state.activityStatusColumns = (state.activityStatusColumns || []).slice().sort((a, b) => {
      const idxA = orderMap.has(a.name) ? orderMap.get(a.name) : 9999;
      const idxB = orderMap.has(b.name) ? orderMap.get(b.name) : 9999;
      return idxA - idxB;
    });
    refreshPopup({ preserveForm: true });
    try {
      await send("SEI_NOTION_SAVE_ACTIVITIES_COLUMN_ORDER", { columnOrder });
    } catch (_) {
      /* ignore */
    }
  }

  async function moveActivity(nup, activityId, statusName) {
    if (!activityId || !statusName) return;
    const act = (state.activities || []).find((a) => a.activityId === activityId);
    if (act) act.statusName = statusName;
    refreshPopup({ preserveForm: true });
    try {
      await send("SEI_NOTION_UPDATE_ACTIVITY_STATUS", {
        activityPageId: activityId,
        statusName
      });
    } catch (err) {
      state.error = err.message || String(err);
      refreshPopup({ preserveForm: true });
    }
  }

  async function deleteActivity(nup, activityId) {
    if (!activityId) return;
    state.activities = (state.activities || []).filter((a) => a.activityId !== activityId);
    refreshPopup({ preserveForm: true });
    try {
      await send("SEI_NOTION_DELETE_ACTIVITY", { activityPageId: activityId });
    } catch (err) {
      state.error = err.message || String(err);
      refreshPopup({ preserveForm: true });
    }
  }

  async function toggleActivityTodo(nup, activityId, blockId, checked) {
    const act = (state.activities || []).find((a) => a.activityId === activityId);
    if (act && Array.isArray(act.checklist)) {
      const item = act.checklist.find((t) => t.id === blockId);
      if (item) item.checked = !!checked;
      act.todoCompleted = act.checklist.filter((t) => t.checked).length;
    }
    refreshPopup({ preserveForm: true });
    try {
      await send("SEI_NOTION_TOGGLE_TODO", { blockId, checked });
    } catch (err) {
      state.error = err.message || String(err);
      refreshPopup({ preserveForm: true });
    }
  }

  async function addActivityTodo(nup, activityId, text) {
    const t = String(text || "").trim();
    if (!t || !activityId) return;
    try {
      const res = await send("SEI_NOTION_ADD_TODO", { pageId: activityId, text: t });
      if (res && res.ok && Array.isArray(res.items)) {
        const act = (state.activities || []).find((a) => a.activityId === activityId);
        if (act) {
          act.checklist = res.items;
          act.todoCount = res.items.length;
          act.todoCompleted = res.items.filter((i) => i.checked).length;
        }
      }
    } catch (err) {
      state.error = err.message || String(err);
    }
    refreshPopup({ preserveForm: true });
  }

  async function deleteActivityTodo(nup, activityId, blockId) {
    if (!blockId) return;
    const act = (state.activities || []).find((a) => a.activityId === activityId);
    if (act && Array.isArray(act.checklist)) {
      act.checklist = act.checklist.filter((t) => t.id !== blockId);
      act.todoCount = act.checklist.length;
      act.todoCompleted = act.checklist.filter((t) => t.checked).length;
    }
    refreshPopup({ preserveForm: true });
    try {
      await send("SEI_NOTION_REMOVE_TODO", { blockId });
    } catch (err) {
      state.error = err.message || String(err);
      refreshPopup({ preserveForm: true });
    }
  }

  async function editActivityTodo(nup, activityId, blockId, text) {
    const t = String(text || "").trim();
    if (!blockId || !t) return;
    const act = (state.activities || []).find((a) => a.activityId === activityId);
    if (act && Array.isArray(act.checklist)) {
      const item = act.checklist.find((t) => t.id === blockId);
      if (item) item.text = t;
    }
    refreshPopup({ preserveForm: true });
    try {
      await send("SEI_NOTION_EDIT_TODO", { blockId, text: t });
    } catch (err) {
      state.error = err.message || String(err);
      refreshPopup({ preserveForm: true });
    }
  }

  async function loadChecklist(pageId) {
    if (!pageId) {
      state.checklist = [];
      return;
    }
    try {
      const res = await send("SEI_NOTION_CHECKLIST", { pageId });
      if (res && res.ok) {
        state.checklist = res.items || [];
        if (Array.isArray(res.templates)) state.templates = res.templates;
      }
    } catch (_) {
      /* ignore */
    }
  }

  async function applyTemplate(nup, templateId, name) {
    const page = pageFor(nup);
    if (!page || !page.pageId || !templateId) return;
    if ((state.checklist || []).length) {
      const ok = window.confirm(
        'Aplicar "' +
          (name || "modelo") +
          '" acrescenta o conteúdo do modelo ao final da página no Notion. Continuar?'
      );
      if (!ok) {
        refreshPopup({ preserveForm: false });
        return false;
      }
    }
    state.error = null;
    SeiNotionPopup.setBusy(true, "Aplicando modelo…");
    try {
      const res = await send("SEI_NOTION_APPLY_TEMPLATE", {
        pageId: page.pageId,
        templateId
      });
      if (!res?.ok) throw new Error(res?.error || "Não foi possível aplicar o modelo.");
      state.checklist = res.items || [];
      state.selectedTemplateId = templateId;
      if (!state.checklist.length) await loadChecklist(page.pageId);
      return true;
    } catch (err) {
      state.error = err.message || String(err);
      return false;
    } finally {
      SeiNotionPopup.setBusy(false);
      refreshPopup({ preserveForm: false });
    }
  }

  async function selectTemplate(nup, templateId, name) {
    const id = String(templateId || "");
    if (!id) {
      state.selectedTemplateId = "";
      refreshPopup({ preserveForm: true });
      return;
    }
    const page = pageFor(nup);
    if (page && page.pageId) {
      await applyTemplate(nup, id, name);
      return;
    }
    if ((state.checklist || []).length) {
      const ok = window.confirm(
        'Trocar para "' +
          (name || "modelo") +
          '" substitui os itens atuais neste popup. Continuar?'
      );
      if (!ok) {
        refreshPopup({ preserveForm: false });
        return;
      }
    }
    state.selectedTemplateId = id;
    state.error = null;
    SeiNotionPopup.setBusy(true, "Carregando checklist…");
    try {
      const res = await send("SEI_NOTION_CHECKLIST", { pageId: id });
      const items = res && res.ok ? res.items || [] : [];
      state.checklist = items.map((item) => ({
        id: newTmpId(),
        text: item.text || "",
        checked: !!item.checked
      }));
    } catch (_) {
      state.checklist = [];
    } finally {
      SeiNotionPopup.setBusy(false);
      refreshPopup({ preserveForm: false });
    }
  }

  async function addTodo(nup, text, depth) {
    const t = String(text || "").trim();
    if (!t) return;
    const d = Number(depth || 0);
    const page = pageFor(nup);
    if (!page || !page.pageId) {
      state.checklist = (state.checklist || []).concat([
        { id: newTmpId(), text: t, checked: false, depth: d }
      ]);
      refreshPopup({ preserveForm: false });
      return;
    }
    state.error = null;
    try {
      const res = await send("SEI_NOTION_ADD_TODO", {
        pageId: page.pageId,
        text: t,
        depth: d
      });
      if (!res?.ok) throw new Error(res?.error || "Não foi possível adicionar o item.");
      state.checklist = Array.isArray(res.items) ? res.items : state.checklist;
      if (!state.checklist.length) await loadChecklist(page.pageId);
    } catch (err) {
      state.error = err.message || String(err);
    }
    refreshPopup({ preserveForm: false });
  }

  async function editTodo(nup, id, text) {
    if (!id) return;
    const t = String(text || "").trim();
    state.checklist = (state.checklist || []).map((item) =>
      item.id === id ? { ...item, text: t } : item
    );
    const page = pageFor(nup);
    if (!page || !page.pageId || !isNotionBlockId(id)) return;
    try {
      const res = await send("SEI_NOTION_EDIT_TODO", { blockId: id, text: t });
      if (!res?.ok) throw new Error(res?.error || "Não foi possível editar o item.");
    } catch (err) {
      state.error = err.message || String(err);
      refreshPopup({ preserveForm: true });
    }
  }

  async function removeTodo(nup, id) {
    if (!id) return;
    state.checklist = (state.checklist || []).filter((item) => item.id !== id);
    const page = pageFor(nup);
    if (!page || !page.pageId || !isNotionBlockId(id)) {
      refreshPopup({ preserveForm: false });
      return;
    }
    try {
      const res = await send("SEI_NOTION_REMOVE_TODO", { blockId: id });
      if (!res?.ok) throw new Error(res?.error || "Não foi possível remover o item.");
    } catch (err) {
      state.error = err.message || String(err);
      await loadChecklist(page.pageId);
    }
    refreshPopup({ preserveForm: false });
  }

  async function toggleTodo(blockId, checked) {
    if (!blockId) return;
    state.checklist = (state.checklist || []).map((item) =>
      item.id === blockId ? { ...item, checked: !!checked } : item
    );
    if (!isNotionBlockId(blockId)) return;
    try {
      const res = await send("SEI_NOTION_TOGGLE_TODO", { blockId, checked: !!checked });
      if (!res?.ok) throw new Error(res?.error || "Não foi possível atualizar o item.");
    } catch (err) {
      state.error = err.message || String(err);
      refreshPopup({ preserveForm: true });
    }
  }

  function handlers() {
    return {
      pages: state.pages,
      creating: state.creating,
      loading: state.loading,
      error: state.error,
      mapping: state.mapping,
      displayMode: usePanelOnThisPage() ? "panel" : "popup",
      onOpen: openPopup
    };
  }

  function isTreeParent() {
    try {
      return !!document.querySelector(
        "frameset, iframe#ifrArvore, iframe[name='ifrArvore'], iframe#ifrConteudoVisualizacao"
      );
    } catch (_) {
      return false;
    }
  }

  function isVizFrame() {
    try {
      const fe = window.frameElement;
      const id = String(
        (fe && (fe.id || fe.name)) || window.name || ""
      );
      return /ifrVisualizacao|ifrConteudoVisualizacao|ifVisualizacao|ifrConteudo/i.test(
        id
      );
    } catch (_) {
      return false;
    }
  }

  function isProcessTreeDoc() {
    if (isTreeParent()) return false;
    try {
      return !!document.querySelector(
        "#divArvore, #divArvoreHtml, .infraArvore, #divArvoreInformacao"
      );
    } catch (_) {
      return false;
    }
  }

  async function openWorkbench() {
    const nup =
      (SeiNotionPopup.processNumber && SeiNotionPopup.processNumber()) ||
      state.seiContext.processNumber ||
      "";
    if (!nup) return;
    try {
      await chrome.storage.local.set({
        seiNotion_workbench: {
          nup,
          seiContext: { ...state.seiContext },
          ts: Date.now()
        }
      });
    } catch (_) {
      /* ignore */
    }
    try {
      const res = await send("SEI_NOTION_OPEN_WORKBENCH", { processNumber: nup });
      if (!res || !res.ok) {
        state.error = (res && res.error) || "Não foi possível abrir a aba.";
        refreshPopup({ preserveForm: true });
      }
    } catch (err) {
      state.error = err.message || String(err);
      refreshPopup({ preserveForm: true });
    }
  }

  async function bootWorkbench() {
    await loadEditor();
    const params = new URLSearchParams(location.search || "");
    const nup = String(params.get("nup") || "").trim();
    try {
      const data = await chrome.storage.local.get("seiNotion_workbench");
      const stored = data && data.seiNotion_workbench;
      if (stored && stored.seiContext && (!nup || sameNup(stored.nup, nup))) {
        state.seiContext = { ...state.seiContext, ...stored.seiContext };
      }
    } catch (_) {
      /* ignore */
    }
    document.title = nup ? "SEI Notion — " + nup : "SEI Notion";
    if (!nup) {
      document.body.innerHTML =
        '<p style="font-family:Segoe UI,sans-serif;padding:24px;color:#64748b;">Abra um processo no SEI e clique em <strong>Abrir em nova aba</strong>.</p>';
      return;
    }
    state.loading = true;
    state.busyLabel = "Carregando dados do Notion…";
    SeiNotionPopup.open(
      popupCtx({
        processNumber: nup,
        uiMode: "page"
      })
    );
    SeiNotionPopup.setBusy(true, "Carregando dados do Notion…");
    await query([nup], { keepBusy: true });
    const page = pageFor(nup);
    if (page && page.pageId) {
      SeiNotionPopup.setBusy(true, "Carregando atividades…");
      await Promise.all([
        loadChecklist(page.pageId),
        loadActivities(page.pageId)
      ]);
    }
    state.loading = false;
    state.busyLabel = "";
    SeiNotionPopup.setBusy(false);
    refreshPopup({ preserveForm: false });
  }

  function usePanelOnThisPage() {
    return false;
  }

  function paint() {
    if (IS_WORKBENCH) return;
    const s = SeiNotionDom.superficie(document);
    const h = handlers();
    if (s.kind === "lista") {
      SeiNotionProcessList.paint(document, h);
    } else if (s.kind === "processo" && s.processNumber && !isTreeParent()) {
      SeiNotionProcessView.paint(document, s.processNumber, h);
    }
  }

  function refreshSeiContext() {
    const s = SeiNotionDom.superficie(document);
    if (s.kind !== "processo" || !s.processNumber) return null;
    if (!SeiNotionProcessView || !SeiNotionProcessView.collectMeta) return null;
    const meta = SeiNotionProcessView.collectMeta(document, s.processNumber, {
      page: pageFor(s.processNumber)
    });
    if (!meta) return null;
    if (meta.processType) state.seiContext.processType = meta.processType;
    if (meta.name) state.seiContext.name = meta.name;
    if (meta.description) state.seiContext.description = meta.description;
    if (meta.assignee) state.seiContext.assignee = meta.assignee;
    if (meta.due) state.seiContext.due = meta.due;
    if (meta.seiUrl) state.seiContext.seiUrl = meta.seiUrl;
    if (Array.isArray(meta.labels) && meta.labels.length) {
      state.seiContext.labels = meta.labels;
    }
    return meta;
  }

  function scheduleSeiContextRefresh() {
    [250, 800, 2000, 4000].forEach((ms) => {
      setTimeout(() => {
        if (!SeiNotionPopup.isOpen() || !usePanelOnThisPage()) return;
        const before = state.seiContext.processType || "";
        refreshSeiContext();
        if ((state.seiContext.processType || "") !== before) {
          refreshPopup({ preserveForm: true });
        }
      }, ms);
    });
  }

  async function fillPanelExtras(nup) {
    const page = pageFor(nup);
    if (page && page.pageId) {
      await Promise.all([
        loadChecklist(page.pageId),
        loadActivities(page.pageId)
      ]);
    } else {
      state.checklist = [];
      state.activities = [];
    }
    refreshPopup({ preserveForm: false });
  }

  async function applyDisplayPreference() {
    if (IS_WORKBENCH) return;
    const s = SeiNotionDom.superficie(document);
    if (s.kind !== "processo" || !isProcessTreeDoc() || !s.processNumber) {
      paint();
      return;
    }
    paint();
    if (state.processDisplay !== "panel") {
      if (SeiNotionPopup.isOpen() && SeiNotionPopup.isPanel && SeiNotionPopup.isPanel()) {
        SeiNotionPopup.close();
      }
    }
  }

  async function boot(opts) {
    try {
      if (IS_WORKBENCH) {
        await bootWorkbench();
        return;
      }
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      document.body.innerHTML =
        '<p style="font-family:Segoe UI,sans-serif;padding:24px;color:#b91c1c;">Não foi possível abrir o processo.<br><span style="color:#64748b;font-size:13px;">' +
        String(msg).replace(/</g, "&lt;") +
        "</span></p>";
      return;
    }
    if (isVizFrame()) return;
    const s = SeiNotionDom.superficie(document);
    if (s.kind === "outro") return;
    await loadEditor();

    let numbers = [];
    if (s.kind === "lista") {
      numbers = SeiNotionDom.findProcessAnchors(document).map(
        (i) => i.processNumber
      );
    } else if (
      s.kind === "processo" &&
      s.processNumber &&
      (isProcessTreeDoc() || !isTreeParent())
    ) {
      numbers = [s.processNumber];
    }
    if (!numbers.length) {
      paint();
      return;
    }
    const key = s.kind + ":" + numbers.join(",");
    if (!opts?.force && key === lastNumbersKey && state.pages.length) {
      paint();
      return;
    }
    lastNumbersKey = key;
    await query(numbers, { light: true });
  }

  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.type === "SEI_NOTION_GET_STATUS") {
      if (IS_WORKBENCH) {
        sendResponse({
          ok: true,
          kind: "workbench",
          processNumber:
            (SeiNotionPopup.processNumber && SeiNotionPopup.processNumber()) ||
            "",
          pages: state.pages.length,
          error: state.error
        });
        return true;
      }
      const s = SeiNotionDom.superficie(document);
      sendResponse({
        ok: true,
        kind: s.kind,
        processNumber: s.processNumber,
        pages: state.pages.length,
        error: state.error
      });
      return true;
    }
    if (msg?.type === "SEI_NOTION_RESCAN") {
      lastNumbersKey = "";
      boot({ force: true }).then(() => sendResponse({ ok: true }));
      return true;
    }
    return false;
  });

  window.addEventListener("pagehide", () => {
    releaseHeld();
    if (!isProcessTreeDoc()) return;
    if (SeiNotionPopup.isOpen() && SeiNotionPopup.isPanel && SeiNotionPopup.isPanel()) {
      SeiNotionPopup.close();
    }
  });

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (IS_WORKBENCH) return;
      if (area !== "local" || !changes.seiNotion_settings) return;
      const next = changes.seiNotion_settings.newValue || {};
      const mode = next.processDisplay === "popup" ? "popup" : "panel";
      if (typeof next.processPanelHeight === "number") {
        state.panelHeight = next.processPanelHeight;
      }
      if (mode === state.processDisplay) return;
      state.processDisplay = mode;
      applyDisplayPreference();
    });
  } catch (_) {
    /* ignore */
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => boot());
  } else {
    boot();
  }
})();
