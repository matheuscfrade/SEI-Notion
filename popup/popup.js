(async function () {
  const stSei = document.getElementById("stSei");
  const stNotion = document.getElementById("stNotion");
  const stPage = document.getElementById("stPage");
  const stProc = document.getElementById("stProc");
  const lead = document.getElementById("lead");

  function set(el, text, cls) {
    el.textContent = text;
    el.className = cls || "";
  }

  async function refresh() {
    const settings = await SeiNotionStorage.getSettings();
    const token = await SeiNotionStorage.getToken();
    const sites = SeiNotionSites.parseSeiSites(settings.seiSites || []);

    let sitesStatus = null;
    try {
      const res = await chrome.runtime.sendMessage({
        type: "SEI_NOTION_SITES_STATUS"
      });
      sitesStatus = res?.status || null;
    } catch (_) {
      /* ignore */
    }

    if (!sites.length) {
      set(stSei, "não configurado", "bad");
    } else if (sitesStatus?.active) {
      set(
        stSei,
        sites.length === 1 ? sites[0].baseUrl : `${sites.length} sites`,
        "ok"
      );
    } else {
      set(stSei, "sem permissão", "warn");
    }

    if (!token) {
      set(stNotion, "sem token", "bad");
    } else if (!settings.dataSourceId) {
      set(stNotion, "sem banco", "warn");
    } else if (!SeiNotionStorage.isReady(settings, token)) {
      set(stNotion, "mapeamento incompleto", "warn");
    } else {
      set(stNotion, settings.dataSourceTitle || "conectado", "ok");
    }

    if (!sites.length) {
      lead.textContent =
        "Obrigatório: abra as opções e informe a URL raiz do SEI.";
    } else if (!token) {
      lead.textContent =
        "Crie uma integração no seu Notion, cole o token nas opções e compartilhe o banco.";
    } else if (!settings.dataSourceId) {
      lead.textContent =
        "Token ok. Escolha o database nas opções e salve o mapeamento.";
    } else if (!SeiNotionStorage.isReady(settings, token)) {
      lead.textContent =
        "Falta mapear as colunas obrigatórias do SEI nas opções.";
    } else {
      lead.textContent =
        "Abra a Controle de Processos ou um processo no SEI. Os cartões usam o Número SEI.";
    }

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
      if (!tab?.id) {
        set(stPage, "—");
        set(stProc, "—");
        return;
      }
      const status = await chrome.tabs.sendMessage(tab.id, {
        type: "SEI_NOTION_GET_STATUS"
      });
      if (status?.kind === "processo") set(stPage, "processo aberto", "ok");
      else if (status?.kind === "lista") set(stPage, "controle de processos", "ok");
      else if (status?.ok) set(stPage, "SEI (outra tela)", "warn");
      else set(stPage, "fora do SEI", "warn");
      set(stProc, status?.processNumber || "—");
    } catch (_) {
      set(stPage, "extensão inativa nesta aba", "warn");
      set(stProc, "—");
    }
  }

  document.getElementById("btnOptions").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById("btnRefresh").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "SEI_NOTION_RESCAN" });
      }
    } catch (_) {
      /* ignore */
    }
    await refresh();
  });

  await refresh();
})();
