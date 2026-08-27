/**
 * Um botão por processo na Controle de Processos — abre o popup.
 */
(function (root) {
  const MARK = "data-sei-notion-trigger";

  function sameNup(a, b) {
    const Schema = root.SeiNotionSchema;
    if (Schema && Schema.sameNup) return Schema.sameNup(a, b);
    return a === b;
  }

  function pageFor(pages, nup) {
    return (pages || []).find((p) => sameNup(p.processNumber, nup));
  }

  function isBusyFor(state, nup) {
    const busyNup = (state && (state.busyProcessNumber || state.creating)) || "";
    return !!(busyNup && nup && sameNup(busyNup, nup));
  }

  function applyBadgeClasses(btn, page, state, nup) {
    btn.classList.toggle("is-linked", !!page);
    btn.classList.toggle("is-busy", isBusyFor(state, nup));
    [...btn.classList].forEach((c) => {
      if (c.indexOf("status-") === 0) btn.classList.remove(c);
    });
    if (page && page.status) {
      const mappedColor =
        state.mapping &&
        state.mapping.badgeColorMap &&
        state.mapping.badgeColorMap[page.status.name];
      const color = mappedColor || page.status.color || "default";
      btn.classList.add("status-" + color);
    }
  }

  function cleanup(doc) {
    const d = doc || document;
    d.querySelectorAll(
      ".sei-notion-box, .sei-notion-toolbar, .sei-notion-card, .sei-notion-create"
    ).forEach((el) => el.remove());
  }

  function ensureTrigger(anchor) {
    const next = anchor.nextElementSibling;
    if (next && next.getAttribute && next.getAttribute(MARK)) return next;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sei-notion-trigger";
    btn.setAttribute(MARK, "1");
    btn.textContent = "N";
    anchor.insertAdjacentElement("afterend", btn);
    return btn;
  }

  function paint(doc, state) {
    const d = doc || document;
    cleanup(d);
    const items = root.SeiNotionDom.findProcessAnchors(d);
    const kept = new Set();
    items.forEach((item) => {
      const page = pageFor(state.pages, item.processNumber);
      const btn = ensureTrigger(item.anchor);
      kept.add(btn);
      applyBadgeClasses(btn, page, state, item.processNumber);
      btn.title = page
        ? "Abrir página do Notion"
        : "Criar / abrir no Notion";
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (state.onOpen) {
          state.onOpen({
            processNumber: item.processNumber,
            name: item.name || "",
            description: item.description || "",
            seiUrl:
              (root.SeiNotionDom.processUrl &&
                root.SeiNotionDom.processUrl(
                  d,
                  item.processNumber,
                  item.anchor
                )) ||
              "",
            labels: item.labels || [],
            assignee: item.assignee || "",
            processType: item.processType || "",
            due: item.due || "",
            page: page || null
          });
        }
      };
    });
    d.querySelectorAll("button.sei-notion-trigger:not(.sei-notion-fab)").forEach(
      (el) => {
        if (!kept.has(el)) el.remove();
      }
    );
    return items.map((i) => i.processNumber);
  }

  root.SeiNotionProcessList = { paint };
})(typeof globalThis !== "undefined" ? globalThis : window);
