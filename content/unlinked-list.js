/**
 * Listagem de processos do Notion na Controle de Processos.
 * O N na barra de comandos do SEI abre o mesmo popup.
 */
(function (root) {
  const HOST_ID = "sei-notion-unlinked-host";
  const LAUNCH_ID = "sei-notion-list-launch";

  let host = null;
  let shadow = null;
  let launchBtn = null;
  let open = false;
  let selectedKey = "";
  let filterKind = "all";
  let columnFilters = {};
  let mapping = null;
  let data = {
    processes: [],
    truncated: false,
    loading: false,
    error: null
  };
  let onFetch = null;
  let onOpen = null;
  let onCreate = null;
  let loadGen = 0;

  function Schema() {
    return root.SeiNotionSchema;
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  const CSS = `
    :host { all: initial; font-family: "Segoe UI", system-ui, sans-serif; }
    .wrap {
      position: fixed;
      inset: 0;
      z-index: 2147483645;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .wrap * { box-sizing: border-box; }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      pointer-events: auto;
    }
    .modal {
      position: relative;
      width: calc(100vw - 24px);
      height: min(560px, 80vh);
      display: flex;
      flex-direction: column;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 24px 64px rgba(15, 23, 42, 0.28);
      overflow: hidden;
      pointer-events: auto;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      flex-shrink: 0;
    }
    .head h3 {
      margin: 0;
      flex: 1;
      font: 600 13px/1.3 "Segoe UI", system-ui, sans-serif;
      color: #0f172a;
    }
    .head-actions { display: flex; align-items: center; gap: 4px; }
    .new-btn {
      padding: 5px 10px;
      border: 1px solid #1e3a8a;
      border-radius: 6px;
      background: #1e3a8a;
      color: #fff;
      font: 600 11px/1 "Segoe UI", system-ui, sans-serif;
      cursor: pointer;
    }
    .new-btn:hover { background: #172554; }
    .icon-btn {
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 6px;
    }
    .icon-btn:hover { color: #0f172a; }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      background: #fff;
      flex-shrink: 0;
    }
    .filter {
      padding: 5px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      background: #fff;
      color: #334155;
      font: 600 11px/1 "Segoe UI", system-ui, sans-serif;
      cursor: pointer;
    }
    .filter:hover { border-color: #1e3a8a; color: #1e3a8a; }
    .filter.is-on {
      background: #1e3a8a;
      border-color: #1e3a8a;
      color: #fff;
    }
    .body {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 0;
    }
    .hint, .err, .empty {
      margin: 12px;
      font: 400 12px/1.45 "Segoe UI", system-ui, sans-serif;
      color: #64748b;
    }
    .err { color: #b91c1c; }
    .loading {
      padding: 16px;
      text-align: center;
      font: 400 12px/1.4 "Segoe UI", system-ui, sans-serif;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font: 400 11px/1.35 "Segoe UI", system-ui, sans-serif;
    }
    thead {
      position: sticky;
      top: 0;
      z-index: 2;
    }
    th, td {
      padding: 7px 10px;
      text-align: left;
      border-bottom: 1px solid #f1f5f9;
      white-space: nowrap;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }
    th {
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
    }
    .filter-row th {
      padding: 4px 6px;
      font-weight: 400;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      overflow: visible;
    }
    .filter-row input, .filter-row select {
      display: block;
      width: 100%;
      min-width: 0;
      height: 26px;
      padding: 0 6px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      color: #0f172a;
      font: 400 11px/1.2 "Segoe UI", system-ui, sans-serif;
    }
    .filter-row input:focus, .filter-row select:focus {
      outline: 2px solid #93c5fd;
      border-color: #1e3a8a;
    }
    th.title-col, td.title-cell { min-width: 160px; max-width: 280px; }
    th.due-col, td.due-cell { min-width: 108px; max-width: 128px; }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: #eff6ff; }
    tbody tr.is-selected {
      background: #dbeafe;
      box-shadow: inset 3px 0 0 #1e3a8a;
    }
    tbody tr.is-selected:hover { background: #bfdbfe; }
    tbody tr.empty-row { cursor: default; box-shadow: none; }
    tbody tr.empty-row:hover { background: transparent; }
    td.title-cell {
      font-weight: 600;
      color: #0f172a;
    }
    td.empty-cell {
      text-align: center;
      color: #64748b;
      white-space: normal;
      max-width: none;
      padding: 28px 12px;
      font: 400 12px/1.45 "Segoe UI", system-ui, sans-serif;
    }
  `;

  function columns() {
    const S = Schema();
    if (S && S.listColumns) return S.listColumns(mapping);
    return [
      { role: "title", kind: "role", label: "Título" },
      { role: "status", kind: "role", label: "Status" },
      { role: "processType", kind: "role", label: "Tipo de processo" }
    ];
  }

  function colKey(col) {
    const S = Schema();
    if (S && S.listColumnKey) return S.listColumnKey(col);
    return (col && col.id) || "";
  }

  function filterKindOf(col) {
    const S = Schema();
    if (S && S.listFilterKind) return S.listFilterKind(col);
    return "text";
  }

  function maskDue(value) {
    const S = Schema();
    if (S && S.maskDateBr) return S.maskDateBr(value);
    return String(value || "");
  }

  function kindFiltered() {
    const S = Schema();
    if (S && S.filterProcesses) {
      return S.filterProcesses(data.processes, filterKind);
    }
    return data.processes.slice();
  }

  function visibleProcesses() {
    const S = Schema();
    if (S && S.filterProcesses) {
      return S.filterProcesses(data.processes, {
        kind: filterKind,
        fields: columnFilters,
        columns: columns()
      });
    }
    return data.processes.slice();
  }

  function filterOptions(col) {
    const S = Schema();
    let values =
      S && S.listFilterOptions
        ? S.listFilterOptions(kindFiltered(), col)
        : [];
    const current = columnFilters[colKey(col)];
    if (current && values.indexOf(current) === -1) {
      values = [current].concat(values);
    }
    return values;
  }

  function hasColumnFilters() {
    return Object.keys(columnFilters).some((k) => columnFilters[k]);
  }

  function itemKey(item) {
    const S = Schema();
    if (S && S.popupKey) return S.popupKey(item);
    if (item && item.pageId) return "id:" + item.pageId;
    if (item && item.processNumber) return "nup:" + item.processNumber;
    return "";
  }

  function cellText(page, col) {
    const S = Schema();
    if (S && S.formatListCell) return S.formatListCell(page, col);
    if (col.role === "title") return page.title || "";
    if (col.role === "status") return (page.status && page.status.name) || "";
    return "";
  }

  function emptyMessage() {
    if (hasColumnFilters()) {
      return "Nenhum processo com esses filtros.";
    }
    if (filterKind === "sei") return "Nenhum processo SEI no Notion.";
    if (filterKind === "external") {
      return "Nenhum processo fora do SEI. Crie um para acompanhar rotina que não está no SEI.";
    }
    return "Nenhum processo no Notion.";
  }

  function optionHtml(values, selected) {
    return (
      `<option value="">Todos</option>` +
      values
        .map(
          (v) =>
            `<option value="${esc(v)}"${
              v === selected ? " selected" : ""
            }>${esc(v)}</option>`
        )
        .join("")
    );
  }

  function colClass(col) {
    if (col && col.role === "title") return " class=\"title-col\"";
    if (col && col.role === "due") return " class=\"due-col\"";
    return "";
  }

  function filterControl(col) {
    const key = colKey(col);
    const kind = filterKindOf(col);
    const val = columnFilters[key] || "";
    const label = esc(col.label || key);
    if (kind === "select") {
      return `<select data-col="${esc(key)}" aria-label="${label}">${optionHtml(
        filterOptions(col),
        val
      )}</select>`;
    }
    if (kind === "date") {
      return `<input data-col="${esc(
        key
      )}" type="text" inputmode="numeric" placeholder="dd/mm/aaaa" maxlength="10" aria-label="${label}" value="${esc(
        val
      )}" />`;
    }
    return `<input data-col="${esc(
      key
    )}" type="search" aria-label="${label}" value="${esc(val)}" />`;
  }

  function rowsHtml(items) {
    const cols = columns();
    if (!items.length) {
      return `<tr class="empty-row"><td class="empty-cell" colspan="${
        cols.length
      }">${esc(emptyMessage())}</td></tr>`;
    }
    return items
      .map((item, index) => {
        const cells = cols
          .map((col) => {
            const text = cellText(item, col);
            const cls =
              col.role === "title"
                ? " class=\"title-cell\""
                : col.role === "due"
                  ? " class=\"due-cell\""
                  : "";
            return `<td${cls} title="${esc(text)}">${esc(text)}</td>`;
          })
          .join("");
        const key = itemKey(item);
        const selected = key && key === selectedKey ? " class=\"is-selected\"" : "";
        return `<tr${selected} data-index="${index}" data-key="${esc(
          key
        )}">${cells}</tr>`;
      })
      .join("");
  }

  function listTable(items) {
    const cols = columns();
    const head = cols
      .map((col) => `<th${colClass(col)}>${esc(col.label)}</th>`)
      .join("");
    const filters = cols
      .map((col) => `<th${colClass(col)}>${filterControl(col)}</th>`)
      .join("");
    return `<table><thead><tr>${head}</tr><tr class="filter-row">${filters}</tr></thead><tbody>${rowsHtml(
      items
    )}</tbody></table>`;
  }

  function bodyHtml() {
    if (data.loading) {
      return `<div class="loading">Carregando…</div>`;
    }
    if (data.error) {
      return `<p class="err">${esc(data.error)}</p>`;
    }
    return (
      listTable(visibleProcesses()) +
      (data.truncated
        ? `<p class="hint">Mostrando os 500 mais recentes. Veja o restante no Notion.</p>`
        : "")
    );
  }

  function renderDrawer() {
    const filterBtn = (kind, label) =>
      `<button type="button" class="filter${
        filterKind === kind ? " is-on" : ""
      }" data-filter="${kind}">${label}</button>`;
    return `
      <div class="backdrop" id="sn-unlinked-backdrop"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="sn-unlinked-title">
        <div class="head">
          <h3 id="sn-unlinked-title">Processos no Notion</h3>
          <div class="head-actions">
            <button type="button" class="new-btn" id="sn-unlinked-new">Novo processo</button>
            <button type="button" class="icon-btn" id="sn-unlinked-refresh" title="Atualizar">↻</button>
            <button type="button" class="icon-btn" id="sn-unlinked-close" title="Fechar">×</button>
          </div>
        </div>
        <div class="filters">
          ${filterBtn("all", "Todos")}
          ${filterBtn("sei", "Processos SEI")}
          ${filterBtn("external", "Processos fora do SEI")}
        </div>
        <div class="body">${bodyHtml()}</div>
      </div>`;
  }

  function ensureHost() {
    if (host && shadow) return;
    host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = HOST_ID;
      document.documentElement.appendChild(host);
    }
    shadow = host.shadowRoot;
    if (!shadow) {
      shadow = host.attachShadow({ mode: "open" });
    }
  }

  function mountLaunch(doc, btn) {
    const Dom = root.SeiNotionDom;
    const bar = Dom && Dom.findListToolbar ? Dom.findListToolbar(doc) : null;
    if (bar) {
      const tag = String(bar.tagName || "").toLowerCase();
      if (tag === "table") {
        let row = bar.querySelector("tr");
        if (!row) {
          row = doc.createElement("tr");
          bar.appendChild(row);
        }
        const cell = doc.createElement("td");
        cell.className = "sei-notion-list-launch-cell";
        cell.appendChild(btn);
        row.appendChild(cell);
        return;
      }
      if (tag === "tr") {
        const cell = doc.createElement("td");
        cell.className = "sei-notion-list-launch-cell";
        cell.appendChild(btn);
        bar.appendChild(cell);
        return;
      }
      bar.appendChild(btn);
      return;
    }
    const table = Dom && Dom.TABELAS_LISTA
      ? doc.querySelector(Dom.TABELAS_LISTA)
      : null;
    if (table && table.parentNode) {
      table.parentNode.insertBefore(btn, table);
      return;
    }
    (doc.body || doc.documentElement).appendChild(btn);
  }

  function bindLaunch(btn) {
    if (!btn) return;
    btn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      open = !open;
      render();
      if (open) load();
    };
  }

  function ensureLaunch(doc) {
    const d = doc || document;
    let btn = d.getElementById(LAUNCH_ID);
    if (btn) {
      launchBtn = btn;
      bindLaunch(btn);
      return btn;
    }
    btn = d.createElement("button");
    btn.type = "button";
    btn.id = LAUNCH_ID;
    btn.className = "sei-notion-trigger sei-notion-list-launch";
    btn.textContent = "N";
    btn.title = "Processos no Notion";
    mountLaunch(d, btn);
    launchBtn = btn;
    bindLaunch(btn);
    return btn;
  }

  function removeLaunch(doc) {
    const d = doc || document;
    const btn = d.getElementById(LAUNCH_ID);
    if (btn) {
      const cell = btn.parentElement;
      if (
        cell &&
        cell.classList &&
        cell.classList.contains("sei-notion-list-launch-cell")
      ) {
        cell.remove();
      } else {
        btn.remove();
      }
    }
    launchBtn = null;
  }

  function render() {
    if (!shadow) return;
    shadow.innerHTML = `<style>${CSS}</style><div class="wrap">${
      open ? renderDrawer() : ""
    }</div>`;
    bindUi();
  }

  function mergeProcesses(fetched) {
    const byId = new Map();
    (fetched || []).forEach((p) => {
      if (p && p.pageId) byId.set(p.pageId, p);
    });
    data.processes.forEach((p) => {
      if (p && p._local && p.pageId && !byId.has(p.pageId)) byId.set(p.pageId, p);
    });
    data.processes = [...byId.values()];
  }

  async function load() {
    if (!onFetch) return;
    const gen = ++loadGen;
    data.loading = true;
    data.error = null;
    render();
    try {
      const res = await onFetch();
      if (gen !== loadGen) return;
      mergeProcesses((res && res.processes) || []);
      data.truncated = !!(res && res.truncated);
      if (res && res.mapping) mapping = res.mapping;
    } catch (err) {
      if (gen !== loadGen) return;
      data.error = (err && err.message) || String(err);
    } finally {
      if (gen === loadGen) data.loading = false;
      if (open) render();
    }
  }

  function bindRows() {
    if (!shadow) return;
    const items = visibleProcesses();
    shadow.querySelectorAll("tbody tr").forEach((row) => {
      row.onclick = () => {
        if (row.classList.contains("empty-row")) return;
        if (!row.hasAttribute("data-index")) return;
        const index = Number(row.getAttribute("data-index"));
        const item = items[index];
        if (!item) return;
        selectedKey = itemKey(item);
        refreshTbody();
        if (onOpen) onOpen(item);
      };
    });
  }

  function refreshTbody() {
    if (!shadow) return;
    const tb = shadow.querySelector(".body tbody");
    if (!tb) return;
    tb.innerHTML = rowsHtml(visibleProcesses());
    bindRows();
  }

  function refreshSelects() {
    if (!shadow) return;
    columns().forEach((col) => {
      if (filterKindOf(col) !== "select") return;
      const key = colKey(col);
      const el = shadow.querySelector(
        '.filter-row [data-col="' + key + '"]'
      );
      if (!el) return;
      const selected = columnFilters[key] || "";
      el.innerHTML = optionHtml(filterOptions(col), selected);
      el.value = selected;
    });
  }

  function bindColumnFilters() {
    if (!shadow) return;
    shadow.querySelectorAll(".filter-row select, .filter-row input").forEach(
      (el) => {
        const apply = () => {
          const key = el.getAttribute("data-col") || "";
          const col = columns().find((c) => colKey(c) === key);
          let val = el.value || "";
          if (col && filterKindOf(col) === "date") {
            val = maskDue(val);
            if (el.value !== val) el.value = val;
          }
          if (val) columnFilters[key] = val;
          else delete columnFilters[key];
          refreshTbody();
        };
        if (el.tagName === "SELECT") el.onchange = apply;
        else el.oninput = apply;
        el.onclick = (ev) => ev.stopPropagation();
      }
    );
  }

  function bindUi() {
    if (!shadow) return;
    function hide() {
      open = false;
      render();
    }
    const closeBtn = shadow.getElementById("sn-unlinked-close");
    if (closeBtn) closeBtn.onclick = hide;
    const backdrop = shadow.getElementById("sn-unlinked-backdrop");
    if (backdrop) backdrop.onclick = hide;
    const refreshBtn = shadow.getElementById("sn-unlinked-refresh");
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        load();
      };
    }
    const newBtn = shadow.getElementById("sn-unlinked-new");
    if (newBtn && onCreate) {
      newBtn.onclick = () => {
        onCreate();
      };
    }
    shadow.querySelectorAll(".filter").forEach((btn) => {
      btn.onclick = () => {
        filterKind = btn.getAttribute("data-filter") || "all";
        shadow.querySelectorAll(".filter").forEach((b) => {
          b.classList.toggle(
            "is-on",
            b.getAttribute("data-filter") === filterKind
          );
        });
        refreshSelects();
        refreshTbody();
      };
    });
    bindColumnFilters();
    bindRows();
  }

  function paint(doc, state) {
    const d = doc || document;
    const show =
      !!(state && state.notionReady) &&
      state.surfaceKind === "lista";
    onFetch =
      (state && (state.fetchProcesses || state.fetchInternal)) || onFetch;
    onOpen =
      (state && (state.onOpen || state.onOpenInternal)) || onOpen;
    onCreate =
      (state && (state.onCreate || state.onCreateInternal)) || onCreate;
    if (state && state.mapping) mapping = state.mapping;
    if (!show) {
      removeLaunch(d);
      if (host) host.remove();
      host = null;
      shadow = null;
      open = false;
      return;
    }
    ensureLaunch(d);
    ensureHost();
    render();
  }

  function close() {
    open = false;
    if (shadow) render();
  }

  function remember(page) {
    if (!page || !page.pageId) return;
    data.processes = [
      { ...page, _local: true },
      ...data.processes.filter((p) => p.pageId !== page.pageId)
    ];
    data.error = null;
  }

  function select(item) {
    selectedKey = item ? itemKey(item) : "";
    if (open && shadow) refreshTbody();
  }

  root.SeiNotionUnlinkedList = {
    paint,
    close,
    remember,
    select,
    isOpen: () => open
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
