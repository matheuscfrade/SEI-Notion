(function () {
  const $ = (sel) => document.querySelector(sel);
  const Schema = globalThis.SeiNotionSchema;

  const els = {
    fldSeiSites: $("#fldSeiSites"),
    btnSaveSeiSites: $("#btnSaveSeiSites"),
    stSeiSites: $("#stSeiSites"),
    stSeiPerm: $("#stSeiPerm"),
    stSeiActive: $("#stSeiActive"),
    fldToken: $("#fldToken"),
    fldEditorName: $("#fldEditorName"),
    btnConnectNotion: $("#btnConnectNotion"),
    btnSaveName: $("#btnSaveName"),
    btnClearToken: $("#btnClearToken"),
    stNotion: $("#stNotion"),
    btnListDs: $("#btnListDs"),
    selDataSource: $("#selDataSource"),
    fldDsUrl: $("#fldDsUrl"),
    btnUseUrl: $("#btnUseUrl"),
    btnPrepare: $("#btnPrepare"),
    btnSaveDs: $("#btnSaveDs"),
    btnRefreshCols: $("#btnRefreshCols"),
    btnDisconnectDs: $("#btnDisconnectDs"),
    mappingBox: $("#mappingBox"),
    colCount: $("#colCount"),
    columnsBox: $("#columnsBox"),
    stDs: $("#stDs"),
    stReady: $("#stReady"),
    version: $("#version"),
    toast: $("#toast"),
    statusColorsCard: $("#statusColorsCard"),
    selStatusCol: $("#selStatusCol"),
    statusColorsBox: $("#statusColorsBox"),
    statusOptionsList: $("#statusOptionsList"),
    btnListActDs: $("#btnListActDs"),
    selActDataSource: $("#selActDataSource"),
    fldActDsUrl: $("#fldActDsUrl"),
    btnUseActUrl: $("#btnUseActUrl"),
    btnPrepareAct: $("#btnPrepareAct"),
    btnSaveActDs: $("#btnSaveActDs"),
    btnRefreshActCols: $("#btnRefreshActCols"),
    btnDisconnectActDs: $("#btnDisconnectActDs"),
    actMappingBox: $("#actMappingBox"),
    selActTitleCol: $("#selActTitleCol"),
    selActStatusCol: $("#selActStatusCol"),
    selActRelCol: $("#selActRelCol"),
    selActAssigneeCol: $("#selActAssigneeCol"),
    selActDueCol: $("#selActDueCol"),
    actStatusPreviewBox: $("#actStatusPreviewBox"),
    actStatusColumnsList: $("#actStatusColumnsList"),
    stActDs: $("#stActDs"),
    stActReady: $("#stActReady"),
    fldProcessDisplay: $("#fldProcessDisplay"),
    btnSaveDisplay: $("#btnSaveDisplay")
  };

  const SEI_ROLES = [
    { value: "", label: "—" },
    { value: "title", label: "Especificação" },
    { value: "processType", label: "Tipo de processo" },
    { value: "labels", label: "Marcadores" },
    { value: "assignee", label: "Atribuição" },
    { value: "notes", label: "Observações" },
    { value: "seiUrl", label: "URL SEI" },
    { value: "due", label: "Prazo" }
  ];

  const POPUP_ROLES = {
    processNumber: true,
    title: true,
    processType: true,
    status: true,
    labels: true,
    assignee: true,
    due: true,
    seiUrl: true,
    notes: true
  };

  let currentSchema = null;
  let currentMapping = null;
  let listedSources = [];
  let knownColumns = new Set();

  function toast(msg, type) {
    els.toast.textContent = msg;
    els.toast.className = `toast ${type || "ok"}`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.add("hidden"), 4200);
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = !!busy;
  }

  async function refreshSeiSitesStatus(opts) {
    const settings = await SeiNotionStorage.getSettings();
    const sites = SeiNotionSites.parseSeiSites(settings.seiSites || []);
    if (els.fldSeiSites && document.activeElement !== els.fldSeiSites) {
      els.fldSeiSites.value = sites.map((s) => s.baseUrl).join("\n");
    }

    let status = null;
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEI_NOTION_SITES_STATUS"
      });
      status = res?.status || null;
    } catch (_) {
      status = null;
    }

    if (
      opts?.autoRepair !== false &&
      status &&
      status.granted?.length &&
      !status.registered &&
      status.sites?.length
    ) {
      try {
        const fix = await chrome.runtime.sendMessage({
          type: "SEI_NOTION_SYNC_CONTENT_SCRIPTS",
          injectOpenTabs: false
        });
        status = fix?.status || status;
      } catch (_) {
        /* ignore */
      }
    }

    const list = status?.sites?.length
      ? status.sites
      : sites.map((s) => s.baseUrl);

    if (!list.length) {
      els.stSeiSites.textContent = "nenhum — informe a URL raiz";
      els.stSeiSites.className = "warn";
    } else {
      els.stSeiSites.textContent = list.join(" · ");
      els.stSeiSites.className = "ok";
    }

    if (!list.length) {
      els.stSeiPerm.textContent = "—";
      els.stSeiPerm.className = "";
    } else if (status?.missing?.length) {
      els.stSeiPerm.textContent = "pendente — clique em Salvar e autorizar";
      els.stSeiPerm.className = "warn";
    } else if (status?.granted?.length) {
      els.stSeiPerm.textContent = "concedida";
      els.stSeiPerm.className = "ok";
    } else {
      els.stSeiPerm.textContent = "desconhecida";
      els.stSeiPerm.className = "warn";
    }

    if (status?.active) {
      els.stSeiActive.textContent = "ativa nestes sites";
      els.stSeiActive.className = "ok";
    } else if (!list.length) {
      els.stSeiActive.textContent = "inativa";
      els.stSeiActive.className = "warn";
    } else if (status?.missing?.length) {
      els.stSeiActive.textContent = "inativa — autorize o acesso no Chrome";
      els.stSeiActive.className = "warn";
    } else if (status?.granted?.length && !status?.registered) {
      els.stSeiActive.textContent = status.lastError
        ? `inativa — ${status.lastError}`
        : "inativa — permissão ok, script não registrado";
      els.stSeiActive.className = "bad";
    } else {
      els.stSeiActive.textContent = "inativa";
      els.stSeiActive.className = "warn";
    }
  }

  async function reconcileHostPermissions(newPatterns) {
    let all;
    try {
      all = await chrome.permissions.getAll();
    } catch (_) {
      return;
    }
    const keep = new Set(["https://api.notion.com/*", ...newPatterns]);
    const toRemove = (all.origins || []).filter((o) => !keep.has(o));
    if (toRemove.length) {
      try {
        await chrome.permissions.remove({ origins: toRemove });
      } catch (_) {
        /* ignore */
      }
    }
  }

  async function saveAndActivateSeiSites() {
    const raw = String(els.fldSeiSites.value || "").trim();
    const sites = SeiNotionSites.parseSeiSites(raw);
    if (!sites.length) {
      toast(
        raw
          ? "URL inválida. Use https://sei.sua-instituicao.gov.br"
          : "Informe ao menos uma URL raiz do SEI.",
        "err"
      );
      await SeiNotionStorage.saveSettings({ seiSites: [] });
      await reconcileHostPermissions([]);
      await chrome.runtime.sendMessage({
        type: "SEI_NOTION_SYNC_CONTENT_SCRIPTS",
        injectOpenTabs: false
      });
      await refreshSeiSitesStatus();
      return;
    }

    const baseUrls = sites.map((s) => s.baseUrl);
    const patterns = sites.map((s) => s.matchPattern);

    setBusy(els.btnSaveSeiSites, true);
    let granted = false;
    try {
      // Must be requested immediately within the user gesture callback
      granted = await chrome.permissions.request({ origins: patterns });
    } catch (err) {
      toast("Falha ao solicitar permissão: " + (err.message || err), "err");
      setBusy(els.btnSaveSeiSites, false);
      await refreshSeiSitesStatus();
      return;
    }

    try {
      await SeiNotionStorage.saveSettings({ seiSites: baseUrls });
      await reconcileHostPermissions(patterns);

      if (!granted) {
        toast("Permissão negada. Sem ela a extensão não atua no SEI.", "err");
        await chrome.runtime.sendMessage({
          type: "SEI_NOTION_SYNC_CONTENT_SCRIPTS",
          injectOpenTabs: false
        });
        await refreshSeiSitesStatus();
        return;
      }

      const res = await chrome.runtime.sendMessage({
        type: "SEI_NOTION_SYNC_CONTENT_SCRIPTS",
        injectOpenTabs: true
      });
      await refreshSeiSitesStatus({ autoRepair: false });

      if (res?.registered || res?.status?.active) {
        const inj =
          res.injected > 0
            ? ` Abas SEI abertas atualizadas (${res.injected}).`
            : " Recarregue a aba do SEI (F5) se os cartões não aparecerem.";
        toast(`${sites.length} site(s) ativo(s).${inj}`);
        return;
      }

      toast(
        "Permissão ok, mas falhou ao ativar: " +
          (res?.error || res?.status?.lastError || "script não registrado"),
        "err"
      );
    } catch (err) {
      toast("Erro ao salvar: " + (err.message || err), "err");
    } finally {
      setBusy(els.btnSaveSeiSites, false);
    }
  }

  async function refreshNotionStatus() {
    const token = await SeiNotionStorage.getToken();
    const settings = await SeiNotionStorage.getSettings();
    if (els.fldEditorName && document.activeElement !== els.fldEditorName) {
      els.fldEditorName.value = settings.editorName || "";
    }
    if (!token) {
      els.stNotion.textContent = "não conectado";
      els.stNotion.className = "warn";
    } else {
      els.stNotion.textContent = "token salvo neste navegador";
      els.stNotion.className = "ok";
    }

    if (settings.dataSourceId) {
      els.stDs.textContent = settings.dataSourceTitle
        ? `${settings.dataSourceTitle} (${settings.dataSourceId.slice(0, 8)}…)`
        : settings.dataSourceId;
      els.stDs.className = "ok";
    } else {
      els.stDs.textContent = "nenhum";
      els.stDs.className = "warn";
    }

    const ready = SeiNotionStorage.isReady(settings, token);
    els.stReady.textContent = ready ? "sim — abra o SEI" : "não — falta token, banco ou Número SEI";
    els.stReady.className = ready ? "ok" : "warn";

    if (settings.activitiesDataSourceId) {
      els.stActDs.textContent = settings.activitiesDataSourceTitle
        ? `${settings.activitiesDataSourceTitle} (${settings.activitiesDataSourceId.slice(0, 8)}…)`
        : settings.activitiesDataSourceId;
      els.stActDs.className = "ok";
    } else {
      els.stActDs.textContent = "nenhum";
      els.stActDs.className = "warn";
    }

    const actReady = SeiNotionStorage.isActivitiesReady(settings, token);
    els.stActReady.textContent = actReady ? "sim — Kanban ativo no popup" : "não — configure o banco e mapeie as colunas";
    els.stActReady.className = actReady ? "ok" : "warn";

    syncProcessDisplayUi(settings.processDisplay);
  }

  function syncProcessDisplayUi(value) {
    const mode = value === "popup" ? "popup" : "panel";
    if (!els.fldProcessDisplay) return;
    els.fldProcessDisplay.querySelectorAll('input[name="processDisplay"]').forEach((el) => {
      el.checked = el.value === mode;
    });
  }

  function readProcessDisplay() {
    const checked = els.fldProcessDisplay
      ? els.fldProcessDisplay.querySelector('input[name="processDisplay"]:checked')
      : null;
    return checked && checked.value === "popup" ? "popup" : "panel";
  }

  async function saveProcessDisplay() {
    const processDisplay = readProcessDisplay();
    await SeiNotionStorage.saveSettings({ processDisplay });
    toast(
      processDisplay === "popup"
        ? "Popup salvo. Recarregue o SEI para o botão N abrir a janela sobreposta."
        : "Painel inferior salvo. Recarregue o SEI para ver o Notion abaixo da visualização."
    );
  }

  let currentActSchema = null;
  let currentActMapping = null;

  async function listActDataSources() {
    setBusy(els.btnListActDs, true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEI_NOTION_LIST_DATA_SOURCES"
      });
      if (!res?.ok) throw new Error(res?.error || "Falha ao listar databases.");
      const list = res.list || [];
      if (!list.length) {
        toast("Nenhum banco compartilhado com a integração.", "warn");
        return;
      }
      els.selActDataSource.innerHTML =
        '<option value="">— selecione a database de atividades —</option>' +
        list
          .map(
            (d) =>
              `<option value="${escapeAttr(d.id)}">${escapeHtml(d.title)} (${escapeHtml(d.id.slice(0, 6))}…)</option>`
          )
          .join("");
      toast(`${list.length} database(s) encontrada(s).`);
    } catch (err) {
      toast(err.message || String(err), "err");
    } finally {
      setBusy(els.btnListActDs, false);
    }
  }

  function ensureActOption(ds) {
    if (!ds || !ds.id) return;
    const exists = Array.from(els.selActDataSource.options).some(
      (o) => o.value === ds.id
    );
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = ds.id;
      opt.textContent = `${ds.title || "Sem título"} (${ds.id.slice(0, 6)}…)`;
      els.selActDataSource.appendChild(opt);
    }
  }

  function renderActStatusPreview(schema, statusColName) {
    if (!els.actStatusColumnsList) return;
    if (!schema || !statusColName) {
      els.actStatusColumnsList.innerHTML = '<span class="hint">Nenhuma coluna de status selecionada.</span>';
      return;
    }
    const cols = Schema.extractStatusColumns(schema, statusColName);
    if (!cols.length) {
      els.actStatusColumnsList.innerHTML = '<span class="hint">Nenhuma opção de status encontrada nesta propriedade.</span>';
      return;
    }
    els.actStatusColumnsList.innerHTML = cols
      .map(
        (c) =>
          `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; background: #e2e8f0; color: #1e293b;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #1e3a8a;"></span>
            ${escapeHtml(c.name)}
          </span>`
      )
      .join("");
  }

  function renderActMappingUi(schema, mapping) {
    currentActSchema = schema;
    currentActMapping = mapping || {};
    const props = Schema.listProperties(schema);

    const titleProps = props.filter((p) => p.type === "title" || p.type === "rich_text");
    els.selActTitleCol.innerHTML = '<option value="">— selecione —</option>' +
      titleProps.map((p) => `<option value="${escapeAttr(p.name)}"${mapping.title === p.name ? " selected" : ""}>${escapeHtml(p.name)} (${escapeHtml(p.type)})</option>`).join("");

    const statusProps = props.filter((p) => p.type === "status" || p.type === "select");
    els.selActStatusCol.innerHTML = '<option value="">— selecione —</option>' +
      statusProps.map((p) => `<option value="${escapeAttr(p.name)}"${mapping.status === p.name ? " selected" : ""}>${escapeHtml(p.name)} (${escapeHtml(p.type)})</option>`).join("");

    const relProps = props.filter((p) => p.type === "relation");
    els.selActRelCol.innerHTML = '<option value="">— selecione —</option>' +
      relProps.map((p) => `<option value="${escapeAttr(p.name)}"${mapping.processRelation === p.name ? " selected" : ""}>${escapeHtml(p.name)} (${escapeHtml(p.type)})</option>`).join("");

    const assProps = props.filter((p) => p.type === "people" || p.type === "rich_text");
    els.selActAssigneeCol.innerHTML = '<option value="">— nenhum —</option>' +
      assProps.map((p) => `<option value="${escapeAttr(p.name)}"${mapping.assignee === p.name ? " selected" : ""}>${escapeHtml(p.name)} (${escapeHtml(p.type)})</option>`).join("");

    const dueProps = props.filter((p) => p.type === "date");
    els.selActDueCol.innerHTML = '<option value="">— nenhum —</option>' +
      dueProps.map((p) => `<option value="${escapeAttr(p.name)}"${mapping.due === p.name ? " selected" : ""}>${escapeHtml(p.name)} (${escapeHtml(p.type)})</option>`).join("");

    renderActStatusPreview(schema, mapping.status);
    els.actMappingBox.classList.remove("hidden");
  }

  function applyActInspected(ds, preferredMapping) {
    currentActSchema = ds.schema;
    const mapping = preferredMapping || ds.mapping;
    renderActMappingUi(ds.schema, mapping);
    els.fldActDsUrl.value = ds.url || ds.id;
    ensureActOption(ds);
    els.selActDataSource.value = ds.id;
  }

  async function inspectActId(id, opts) {
    if (!id) return;
    const settings = await SeiNotionStorage.getSettings();
    const res = await chrome.runtime.sendMessage({
      type: "SEI_NOTION_INSPECT_ACTIVITIES_DS",
      activitiesDataSourceId: id,
      processDataSourceId: settings.dataSourceId
    });
    if (!res?.ok) throw new Error(res?.error || "Falha ao inspecionar banco de atividades.");
    applyActInspected(
      res.dataSource,
      opts?.refresh ? null : settings.activitiesMapping
    );
  }

  async function useActUrl() {
    const input = els.fldActDsUrl.value.trim();
    if (!input) {
      toast("Cole o link ou o ID do database de atividades.", "err");
      return;
    }
    setBusy(els.btnUseActUrl, true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEI_NOTION_RESOLVE_DATA_SOURCE",
        input
      });
      if (!res?.ok) throw new Error(res?.error || "Não encontrei esse banco de atividades.");
      await inspectActId(res.dataSource.id);
      toast("Banco de atividades encontrado: " + res.dataSource.title);
    } catch (err) {
      toast(err.message || String(err), "err");
    } finally {
      setBusy(els.btnUseActUrl, false);
    }
  }

  async function prepareAct() {
    const id = els.selActDataSource.value;
    if (!id) {
      toast("Escolha um banco de atividades antes.", "err");
      return;
    }
    const settings = await SeiNotionStorage.getSettings();
    if (!settings.dataSourceId) {
      toast("Configure e salve o Banco de Processos (Seção 3) antes de preparar as Atividades.", "warn");
      return;
    }
    setBusy(els.btnPrepareAct, true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEI_NOTION_PREPARE_ACTIVITIES_DS",
        activitiesDataSourceId: id,
        processDataSourceId: settings.dataSourceId
      });
      if (!res?.ok) throw new Error(res?.error || "Não consegui preparar o banco de atividades.");
      applyActInspected(res.dataSource);
      toast("Banco de atividades preparado (Status e Relação criadas). Confira o mapeamento e salve.");
    } catch (err) {
      toast(err.message || String(err), "err");
    } finally {
      setBusy(els.btnPrepareAct, false);
    }
  }

  function readActMappingFromUi() {
    return {
      title: els.selActTitleCol.value || "",
      status: els.selActStatusCol.value || "",
      processRelation: els.selActRelCol.value || "",
      assignee: els.selActAssigneeCol.value || "",
      due: els.selActDueCol.value || ""
    };
  }

  async function saveActDataSource() {
    const id = els.selActDataSource.value;
    if (!id) {
      toast("Escolha um banco de atividades.", "err");
      return;
    }
    const mapping = readActMappingFromUi();
    if (!mapping.title) {
      toast("Mapeie a coluna de Título da Atividade.", "err");
      return;
    }
    if (!mapping.status) {
      toast("Mapeie a coluna de Status/Kanban da Atividade.", "err");
      return;
    }
    if (!mapping.processRelation) {
      toast("Mapeie a coluna de Relação com o Processo SEI.", "err");
      return;
    }
    const opt = els.selActDataSource.selectedOptions[0];
    await SeiNotionStorage.saveSettings({
      activitiesDataSourceId: id,
      activitiesDataSourceTitle: opt ? opt.textContent : "",
      activitiesDataSourceUrl: els.fldActDsUrl.value.trim(),
      activitiesMapping: mapping
    });
    await refreshNotionStatus();
    toast("Banco de atividades salvo com sucesso!");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function roleOfColumn(mapping, name) {
    const keys = [
      "title",
      "processType",
      "status",
      "labels",
      "assignee",
      "due",
      "seiUrl",
      "notes"
    ];
    for (const key of keys) {
      if (mapping && mapping[key] === name) return key;
    }
    return "";
  }

  function popupIdFor(role, name) {
    if (role && POPUP_ROLES[role]) return "role:" + role;
    if (!role && name) return "extra:" + name;
    return "";
  }

  function schemaPropertyNames(schema) {
    return Schema.listProperties(schema)
      .filter((p) => !Schema.isLockProperty(p.name))
      .map((p) => p.name);
  }

  function populateStatusColDropdown(schema, selectedValue) {
    const cols = Schema.listProperties(schema).filter(
      (p) => p.type === "status" || p.type === "select"
    );
    els.selStatusCol.innerHTML =
      '<option value="">— não usar cor por status (manter azul padrão) —</option>' +
      cols
        .map(
          (c) =>
            `<option value="${escapeAttr(c.name)}">${escapeHtml(c.name)} (${escapeHtml(c.type)})</option>`
        )
        .join("");
    els.selStatusCol.value = selectedValue || "";
  }

  function renderStatusColorsList(schema, columnName, badgeColorMap) {
    if (!columnName) {
      els.statusColorsBox.classList.add("hidden");
      return;
    }
    const prop = Schema.findProperty(schema, columnName);
    if (!prop || (prop.type !== "status" && prop.type !== "select")) {
      els.statusColorsBox.classList.add("hidden");
      return;
    }
    els.statusColorsBox.classList.remove("hidden");
    const options = Schema.selectOptions(schema, columnName);
    const map = badgeColorMap || {};
    els.statusOptionsList.innerHTML = options
      .map((opt) => {
        const name = opt.name;
        const color = map[name] || opt.color || "default";
        return `<div class="status-color-row" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; margin-bottom: 6px;">
          <span style="font-weight: 600; font-size: 13px;">${escapeHtml(name)}</span>
          <select class="status-color-sel" data-opt-name="${escapeAttr(name)}" aria-label="Cor para ${escapeAttr(name)}" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; font-size: 12px;">
            <option value="default"${color === "default" ? " selected" : ""}>Azul Padrão (SEI)</option>
            <option value="gray"${color === "gray" ? " selected" : ""}>Cinza</option>
            <option value="brown"${color === "brown" ? " selected" : ""}>Marrom</option>
            <option value="orange"${color === "orange" ? " selected" : ""}>Laranja</option>
            <option value="yellow"${color === "yellow" ? " selected" : ""}>Amarelo</option>
            <option value="green"${color === "green" ? " selected" : ""}>Verde</option>
            <option value="blue"${color === "blue" ? " selected" : ""}>Azul</option>
            <option value="purple"${color === "purple" ? " selected" : ""}>Roxo</option>
            <option value="pink"${color === "pink" ? " selected" : ""}>Rosa</option>
            <option value="red"${color === "red" ? " selected" : ""}>Vermelho</option>
          </select>
        </div>`;
      })
      .join("");
  }

  function applyInspected(ds, preferredMapping) {
    currentSchema = ds.schema;
    const mapping = preferredMapping || ds.mapping;
    populateStatusColDropdown(ds.schema, mapping.status);
    renderColumnsBox(ds.schema, mapping);
    renderStatusColorsList(ds.schema, mapping.status, mapping.badgeColorMap);
    els.mappingBox.classList.remove("hidden");
    els.fldDsUrl.value = ds.url || ds.id;
    ensureOption(ds);
    els.selDataSource.value = ds.id;
  }

  function renderColumnsBox(schema, mapping) {
    if (!els.columnsBox) return;
    currentMapping = mapping;
    const listed = Schema.listProperties(schema).filter(
      (p) => !Schema.isLockProperty(p.name)
    );
    if (els.colCount) {
      els.colCount.innerHTML = listed.length
        ? listed.length + " coluna(s) encontradas no Notion."
        : "Nenhuma coluna. Clique em Atualizar colunas.";
    }

    let fixedRolesBox = document.getElementById("fixedRolesBox");
    let extraColumnsBox = document.getElementById("extraColumnsBox");
    if (!fixedRolesBox || !extraColumnsBox) {
      els.columnsBox.innerHTML = `
        <div class="mapping-section">
          <h4 style="margin-top: 0; margin-bottom: 12px; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; font-size: 15px;">Mapeamento de Papéis (Obrigatórios)</h4>
          <div class="roles-head" style="display: grid; grid-template-columns: 2fr 2fr 1fr; gap: 12px; font-weight: 700; font-size: 13px; color: #475569; margin-bottom: 8px;">
            <span>Papel no SEI</span>
            <span>Coluna correspondente no Notion</span>
            <span style="text-align: center;">Mostrar no popup</span>
          </div>
          <div id="fixedRolesBox" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px;"></div>
        </div>
        <div class="mapping-section">
          <h4 style="margin-top: 16px; margin-bottom: 12px; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; font-size: 15px;">Colunas Adicionais no Popup (Opcionais)</h4>
          <p class="hint" style="margin-bottom: 12px; font-size: 12px;">
            As demais colunas do seu banco Notion que não possuem um papel no SEI podem ser exibidas no popup da extensão. Marque "Mostrar" e ordene-as com ↑↓.
          </p>
          <div class="col-head" aria-hidden="true" style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 12px; font-weight: 700; font-size: 13px; color: #475569; margin-bottom: 8px;">
            <span>Coluna no Notion</span>
            <span>Mostrar no popup</span>
            <span>Ordem</span>
          </div>
          <div id="extraColumnsBox" style="display: flex; flex-direction: column; gap: 10px;"></div>
        </div>
      `;
      fixedRolesBox = document.getElementById("fixedRolesBox");
      extraColumnsBox = document.getElementById("extraColumnsBox");
    }

    const roleLabels = {
      processNumber: "Número SEI",
      processType: "Tipo de processo",
      title: "Especificação",
      labels: "Marcadores",
      due: "Prazo",
      assignee: "Atribuição",
      notes: "Observações",
      seiUrl: "URL SEI"
    };

    // 1. Render Section 1: Fixed roles dropdowns
    const hiddenSet = new Set(Array.isArray(mapping.hiddenRoles) ? mapping.hiddenRoles : []);

    fixedRolesBox.innerHTML = Schema.FIXED_ORDER_ROLES.map((role) => {
      const label = roleLabels[role];
      const compatTypes = Schema.COMPAT[role] || [];
      const compatCols = listed.filter((c) => compatTypes.includes(c.type));
      const currentSelectedValue = mapping[role] || "";
      
      const optionsHtml = [
        `<option value="">— selecione a coluna —</option>`
      ].concat(
        compatCols.map((c) => {
          const sel = c.name === currentSelectedValue ? " selected" : "";
          return `<option value="${escapeAttr(c.name)}"${sel}>${escapeHtml(c.name)} (${escapeHtml(c.type)})</option>`;
        })
      ).join("");

      const showInPopupChecked = !hiddenSet.has(role) ? " checked" : "";
      const isNup = role === "processNumber";
      const checkboxDisabled = isNup ? " disabled" : "";

      return `<div class="role-map-row" style="display: grid; grid-template-columns: 2fr 2fr 1fr; gap: 12px; align-items: center; padding: 6px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; margin-bottom: 6px;">
        <span style="font-weight: 600; font-size: 13px; color: #1e293b;">${escapeHtml(label)} *</span>
        <select class="role-select" data-role="${escapeAttr(role)}" aria-label="${escapeAttr(label)}" style="padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; font-size: 13px; width: 100%;">
          ${optionsHtml}
        </select>
        <label class="col-show" style="display: flex; justify-content: center; align-items: center; margin: 0;" title="${isNup ? "Número SEI é obrigatório no popup" : "Mostrar no popup"}">
          <input type="checkbox" class="role-popup" data-role="${escapeAttr(role)}"${showInPopupChecked}${checkboxDisabled} style="cursor: pointer; width: 16px; height: 16px; margin: 0;" />
        </label>
      </div>`;
    }).join("");

    // 2. Render Section 2: Extra columns helper
    const updateExtras = () => {
      const selectedCols = new Set();
      [...fixedRolesBox.querySelectorAll(".role-select")].forEach((select) => {
        if (select.value) {
          selectedCols.add(select.value);
        }
      });

      const unmappedCols = listed.filter((p) => !selectedCols.has(p.name));
      const extraSet = new Set(Array.isArray(mapping.extra) ? mapping.extra : []);
      const hiddenSet = new Set(Array.isArray(mapping.hiddenRoles) ? mapping.hiddenRoles : []);
      const statusColName = els.selStatusCol ? els.selStatusCol.value : "";

      const orderIndex = {};
      const saved = Array.isArray(mapping.order) ? mapping.order : [];
      saved.forEach((id, idx) => {
        orderIndex[id] = idx;
      });

      const rows = unmappedCols.map((p, idx) => {
        const isStatus = !!(statusColName && p.name === statusColName);
        const pid = isStatus ? "role:status" : "extra:" + p.name;
        const inPopup = isStatus ? !hiddenSet.has("status") : extraSet.has(p.name);
        return { prop: p, isStatus, inPopup, pid, listedIndex: idx };
      });

      rows.sort((a, b) => {
        const as = orderIndex[a.pid] != null ? orderIndex[a.pid] : 1000 + a.listedIndex;
        const bs = orderIndex[b.pid] != null ? orderIndex[b.pid] : 1000 + b.listedIndex;
        return as - bs;
      });

      extraColumnsBox.innerHTML = rows.map((r, i) => {
        const p = r.prop;
        const checked = r.inPopup ? " checked" : "";
        const pos = i + 1;
        const upDis = i === 0 ? " disabled" : "";
        const downDis = i === rows.length - 1 ? " disabled" : "";
        const badge = r.isStatus
          ? ` <span style="font-size: 10px; font-weight: 700; color: #1e3a8a; background: #e0e7ff; padding: 1px 6px; border-radius: 4px; margin-left: 6px;">Status do card</span>`
          : "";

        return `<div class="col-row${r.inPopup ? " in-popup" : ""}" data-name="${escapeAttr(p.name)}" data-pid="${escapeAttr(r.pid)}" style="grid-template-columns: 2fr 1fr 1fr; margin-bottom: 6px;">
          <div class="col-name" style="display: flex; flex-direction: column;">
            <strong style="font-size: 13px; color: #1e293b;">${escapeHtml(p.name)}${badge}</strong>
            <em style="font-size: 11px; color: #64748b;">${escapeHtml(p.type)}</em>
          </div>
          <label class="col-show" style="display: flex; justify-content: center; align-items: center; margin: 0;">
            <input type="checkbox" class="col-popup"${checked} style="cursor: pointer; width: 16px; height: 16px; margin: 0;" />
          </label>
          <div class="col-ord" style="display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span class="order-pos" style="font-size: 12px; font-weight: 600; color: #64748b; margin-right: 6px;">${pos}</span>
            <button type="button" class="btn btn-ghost-dark order-up"${upDis} aria-label="Subir" style="padding: 2px 6px; font-size: 11px;">↑</button>
            <button type="button" class="btn btn-ghost-dark order-down"${downDis} aria-label="Descer" style="padding: 2px 6px; font-size: 11px;">↓</button>
          </div>
        </div>`;
      }).join("");
    };

    updateExtras();

    // Attach listeners to update extras when dropdown selection changes
    [...fixedRolesBox.querySelectorAll(".role-select")].forEach((select) => {
      select.addEventListener("change", () => {
        updateExtras();
      });
    });

    listed.forEach((p) => knownColumns.add(p.name));
  }

  function ensureOption(ds) {
    const exists = [...els.selDataSource.options].some((o) => o.value === ds.id);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = ds.id;
      opt.textContent = ds.title || ds.id;
      els.selDataSource.appendChild(opt);
    }
  }

  function readMappingFromUi() {
    const mapping = Schema.emptyMapping();
    
    // 1. Read fixed roles mapping and checkbox status
    const hiddenRoles = [];
    const fixedSelects = [...document.querySelectorAll("#fixedRolesBox .role-select")];
    fixedSelects.forEach((select) => {
      const role = select.getAttribute("data-role");
      if (role) {
        mapping[role] = select.value;
        const checkbox = document.querySelector(`.role-popup[data-role="${role}"]`);
        if (checkbox && !checkbox.checked) {
          hiddenRoles.push(role);
        }
      }
    });

    // 2. Read extra columns and order
    const extra = [];
    const order = [];
    
    // First, standard roles are always in FIXED_ORDER_ROLES order in mapping.order
    Schema.FIXED_ORDER_ROLES.forEach((role) => {
      order.push("role:" + role);
    });

    const statusCol = els.selStatusCol ? els.selStatusCol.value : "";
    mapping.status = statusCol;

    // Read the extra columns rows
    let statusInRows = false;
    const extraRows = [...document.querySelectorAll("#extraColumnsBox .col-row")];
    extraRows.forEach((row) => {
      const name = row.getAttribute("data-name");
      const pid = row.getAttribute("data-pid") || ("extra:" + name);
      if (!name) return;
      const show = !!(row.querySelector(".col-popup") || {}).checked;
      
      if (pid === "role:status" || (statusCol && name === statusCol)) {
        if (!show) {
          hiddenRoles.push("status");
        }
        order.push("role:status");
      } else {
        if (show) {
          extra.push(name);
        }
        order.push("extra:" + name);
      }
    });

    mapping.extra = extra;
    mapping.hiddenRoles = hiddenRoles;
    
    const badgeColorMap = {};
    if (statusCol && els.statusOptionsList) {
      [...els.statusOptionsList.querySelectorAll(".status-color-sel")].forEach((sel) => {
        const optName = sel.getAttribute("data-opt-name");
        if (optName) {
          badgeColorMap[optName] = sel.value;
        }
      });
    }
    mapping.badgeColorMap = badgeColorMap;

    mapping.order = order;
    mapping.orderCustom = true;
    return mapping;
  }

  async function connectNotion() {
    const token = els.fldToken.value.trim();
    if (!token) {
      toast("Cole o token do Notion.", "err");
      return;
    }
    setBusy(els.btnConnectNotion, true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEI_NOTION_TEST_TOKEN",
        token
      });
      if (!res?.ok) throw new Error(res?.error || "Falha ao conectar.");
      els.fldToken.value = "";
      await refreshNotionStatus();
      toast("Notion conectado" + (res.me?.name ? `: ${res.me.name}` : "."));
      try {
        await listDataSources();
      } catch (_) {
        /* ignore */
      }
    } catch (err) {
      toast(err.message || String(err), "err");
    } finally {
      setBusy(els.btnConnectNotion, false);
    }
  }

  async function listDataSources() {
    setBusy(els.btnListDs, true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEI_NOTION_LIST_DATA_SOURCES"
      });
      if (!res?.ok) throw new Error(res?.error || "Não foi possível listar.");
      listedSources = res.list || [];
      els.selDataSource.innerHTML =
        '<option value="">— escolha um banco —</option>' +
        listedSources
          .map(
            (d) =>
              `<option value="${escapeAttr(d.id)}">${escapeHtml(d.title)}</option>`
          )
          .join("");
      const settings = await SeiNotionStorage.getSettings();
      if (settings.dataSourceId) {
        ensureOption({
          id: settings.dataSourceId,
          title: settings.dataSourceTitle || settings.dataSourceId
        });
        els.selDataSource.value = settings.dataSourceId;
      }
      if (!listedSources.length) {
        toast(
          "Nenhum banco visível. Compartilhe o database com a integração (••• → Add connections).",
          "err"
        );
      } else {
        toast(`${listedSources.length} banco(s) visível(is).`);
      }
    } catch (err) {
      toast(err.message || String(err), "err");
    } finally {
      setBusy(els.btnListDs, false);
    }
  }

  async function inspectId(id, opts) {
    if (!id) return;
    const res = await chrome.runtime.sendMessage({
      type: "SEI_NOTION_INSPECT_DATA_SOURCE",
      dataSourceId: id
    });
    if (!res?.ok) throw new Error(res?.error || "Falha ao ler o banco.");
    const settings = await SeiNotionStorage.getSettings();
    let prefer = res.dataSource.mapping;
    if (opts && opts.refresh) {
      prefer = Schema.mergeMapping(res.dataSource.schema, {
        ...settings.mapping,
        orderCustom: false
      });
    } else if (settings.dataSourceId === id) {
      prefer = Schema.mergeMapping(res.dataSource.schema, settings.mapping);
    }
    applyInspected(res.dataSource, prefer);
    return res.dataSource;
  }

  async function useUrl() {
    const input = els.fldDsUrl.value.trim();
    if (!input) {
      toast("Cole o link ou o ID do database.", "err");
      return;
    }
    setBusy(els.btnUseUrl, true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEI_NOTION_RESOLVE_DATA_SOURCE",
        input
      });
      if (!res?.ok) throw new Error(res?.error || "Não encontrei esse banco.");
      applyInspected(res.dataSource);
      toast("Banco encontrado: " + res.dataSource.title);
    } catch (err) {
      toast(err.message || String(err), "err");
    } finally {
      setBusy(els.btnUseUrl, false);
    }
  }

  async function prepare() {
    const id = els.selDataSource.value;
    if (!id) {
      toast("Escolha um banco antes.", "err");
      return;
    }
    setBusy(els.btnPrepare, true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEI_NOTION_PREPARE_DATA_SOURCE",
        dataSourceId: id
      });
      if (!res?.ok) throw new Error(res?.error || "Não consegui alterar o banco.");
      applyInspected(res.dataSource);
      const miss = res.dataSource.missing || [];
      toast(
        miss.length
          ? "Ainda faltam colunas: " + miss.join(", ")
          : "Colunas padrão prontas. Confira o mapeamento e salve."
      );
    } catch (err) {
      toast(err.message || String(err), "err");
    } finally {
      setBusy(els.btnPrepare, false);
    }
  }

  async function saveDataSource() {
    const id = els.selDataSource.value;
    if (!id) {
      toast("Escolha um banco.", "err");
      return;
    }
    const mapping = readMappingFromUi();
    const roleLabels = {
      processNumber: "Número SEI",
      processType: "Tipo de processo"
    };
    const requiredRoles = ["processNumber", "processType"];
    for (const role of requiredRoles) {
      if (!mapping[role]) {
        toast(`Mapeie o papel obrigatório "${roleLabels[role]}" (ou prepare o banco).`, "err");
        return;
      }
    }
    const opt = els.selDataSource.selectedOptions[0];
    await SeiNotionStorage.saveSettings({
      dataSourceId: id,
      dataSourceTitle: opt ? opt.textContent : "",
      dataSourceUrl: els.fldDsUrl.value.trim(),
      mapping
    });
    await refreshNotionStatus();
    toast("Banco salvo. Recarregue o SEI para ver os cartões.");
  }

  async function init() {
    try {
      els.version.textContent = chrome.runtime.getManifest().version;
    } catch (_) {
      /* ignore */
    }
    await SeiNotionStorage.ensureSeeded();
    await refreshSeiSitesStatus();
    await refreshNotionStatus();

    const settings = await SeiNotionStorage.getSettings();
    if (settings.dataSourceId) {
      try {
        await inspectId(settings.dataSourceId);
      } catch (_) {
        /* token ausente ou banco inacessível */
      }
    }
    if (settings.activitiesDataSourceId) {
      try {
        await inspectActId(settings.activitiesDataSourceId);
      } catch (_) {
        /* token ausente ou banco inacessível */
      }
    }

    els.btnSaveSeiSites.addEventListener("click", saveAndActivateSeiSites);
    if (els.btnSaveDisplay) {
      els.btnSaveDisplay.addEventListener("click", saveProcessDisplay);
    }
    if (els.fldProcessDisplay) {
      els.fldProcessDisplay.addEventListener("change", saveProcessDisplay);
    }
    els.btnConnectNotion.addEventListener("click", connectNotion);
    if (els.btnSaveName) {
      els.btnSaveName.addEventListener("click", async () => {
        const editorName = (els.fldEditorName.value || "").trim();
        await SeiNotionStorage.saveSettings({ editorName });
        toast(
          editorName
            ? "Nome salvo. As outras pessoas verão este nome se você estiver editando."
            : "Nome limpo."
        );
      });
    }
    els.btnClearToken.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "SEI_NOTION_CLEAR_TOKEN" });
      els.fldToken.value = "";
      await refreshNotionStatus();
      toast("Token removido deste navegador.");
    });
    els.btnListDs.addEventListener("click", listDataSources);
    els.selDataSource.addEventListener("change", async () => {
      try {
        await inspectId(els.selDataSource.value);
      } catch (err) {
        toast(err.message || String(err), "err");
      }
    });
    els.btnUseUrl.addEventListener("click", useUrl);
    els.btnPrepare.addEventListener("click", prepare);
    els.btnSaveDs.addEventListener("click", saveDataSource);
    els.btnRefreshCols.addEventListener("click", async () => {
      const id = els.selDataSource.value;
      if (!id) {
        toast("Escolha ou reconecte um banco primeiro.", "err");
        return;
      }
      setBusy(els.btnRefreshCols, true);
      try {
        knownColumns = new Set();
        await inspectId(id, { refresh: true });
        toast("Colunas recarregadas do Notion. Confira o mapeamento e salve.");
      } catch (err) {
        toast(err.message || String(err), "err");
      } finally {
        setBusy(els.btnRefreshCols, false);
      }
    });
    if (els.columnsBox) {
      els.columnsBox.addEventListener("change", (ev) => {
        const checkbox = ev.target.closest && (ev.target.closest(".col-popup") || ev.target.closest(".role-popup"));
        if (checkbox && currentSchema) {
          renderColumnsBox(currentSchema, readMappingFromUi());
        }
      });
      els.columnsBox.addEventListener("click", (ev) => {
        const up = ev.target.closest && ev.target.closest(".order-up");
        const down = ev.target.closest && ev.target.closest(".order-down");
        if (!up && !down) return;
        const row = ev.target.closest(".col-row");
        if (!row || !els.columnsBox.contains(row) || !currentSchema) return;
        const mapping = readMappingFromUi();
        const pid = row.getAttribute("data-pid") || "";
        if (!pid) return;
        
        // Filter out fixed roles to get extras
        const fixedIds = Schema.FIXED_ORDER_ROLES.map(r => "role:" + r);
        const rest = (mapping.order || []).filter((id) => !fixedIds.includes(id));
        const i = rest.indexOf(pid);
        if (i < 0) return;
        if (up && i > 0) {
          const swap = rest[i - 1];
          rest[i - 1] = rest[i];
          rest[i] = swap;
        }
        if (down && i < rest.length - 1) {
          const swap = rest[i + 1];
          rest[i + 1] = rest[i];
          rest[i] = swap;
        }
        mapping.order = fixedIds.concat(rest);
        mapping.orderCustom = true;
        renderColumnsBox(currentSchema, mapping);
      });
    }

    if (els.selStatusCol) {
      els.selStatusCol.addEventListener("change", () => {
        if (!currentSchema) return;
        renderStatusColorsList(currentSchema, els.selStatusCol.value, currentMapping ? currentMapping.badgeColorMap : null);
        renderColumnsBox(currentSchema, readMappingFromUi());
      });
    }

    els.btnDisconnectDs.addEventListener("click", async () => {
      await SeiNotionStorage.clearDataSource();
      currentSchema = null;
      currentMapping = null;
      knownColumns = new Set();
      els.selDataSource.innerHTML =
        '<option value="">— conecte o Notion e liste os bancos —</option>';
      els.fldDsUrl.value = "";
      els.mappingBox.classList.add("hidden");
      if (els.columnsBox) els.columnsBox.innerHTML = "";
      if (els.selStatusCol) els.selStatusCol.innerHTML = '<option value="">— não usar cor por status (manter azul padrão) —</option>';
      if (els.statusColorsBox) els.statusColorsBox.classList.add("hidden");
      await refreshNotionStatus();
      toast("Banco desconectado. Escolha outro ou o mesmo e salve de novo.");
    });

    // Activities Section Listeners
    els.btnListActDs.addEventListener("click", listActDataSources);
    els.selActDataSource.addEventListener("change", async () => {
      try {
        await inspectActId(els.selActDataSource.value);
      } catch (err) {
        toast(err.message || String(err), "err");
      }
    });
    els.btnUseActUrl.addEventListener("click", useActUrl);
    els.btnPrepareAct.addEventListener("click", prepareAct);
    els.btnSaveActDs.addEventListener("click", saveActDataSource);
    els.btnRefreshActCols.addEventListener("click", async () => {
      const id = els.selActDataSource.value;
      if (!id) {
        toast("Escolha ou reconecte o banco de atividades primeiro.", "err");
        return;
      }
      setBusy(els.btnRefreshActCols, true);
      try {
        await inspectActId(id, { refresh: true });
        toast("Colunas do banco de atividades recarregadas. Confira o mapeamento e salve.");
      } catch (err) {
        toast(err.message || String(err), "err");
      } finally {
        setBusy(els.btnRefreshActCols, false);
      }
    });
    els.selActStatusCol.addEventListener("change", () => {
      if (currentActSchema) {
        renderActStatusPreview(currentActSchema, els.selActStatusCol.value);
      }
    });
    els.btnDisconnectActDs.addEventListener("click", async () => {
      await SeiNotionStorage.clearActivitiesDataSource();
      currentActSchema = null;
      currentActMapping = null;
      els.selActDataSource.innerHTML =
        '<option value="">— selecione a database de atividades —</option>';
      els.fldActDsUrl.value = "";
      els.actMappingBox.classList.add("hidden");
      if (els.actStatusColumnsList) els.actStatusColumnsList.innerHTML = "";
      await refreshNotionStatus();
      toast("Banco de atividades desconectado.");
    });
  }

  init().catch((e) => console.error(e));
})();
