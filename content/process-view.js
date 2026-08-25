/**
 * Ícone pequeno ao lado do número do processo aberto.
 */
(function (root) {
  const MARK = "data-sei-notion-process-trigger";

  function pageFor(pages, nup) {
    const Schema = root.SeiNotionSchema;
    if (Schema && Schema.sameNup) {
      return (pages || []).find((p) => Schema.sameNup(p.processNumber, nup));
    }
    return (pages || []).find((p) => p.processNumber === nup);
  }

  function compactText(el) {
    return ((el && el.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function findNumberElement(doc, processNumber) {
    const d = doc || document;
    const nup = String(processNumber || "").trim();
    if (!nup) return null;

    const scopes = [
      "#divArvore",
      "#divArvoreHtml",
      ".infraArvore",
      "#divArvoreInformacao",
      "#divInfraBarraLocalizacao",
      "#divInfraAreaTelaD",
      "body"
    ];

    let best = null;
    for (const sel of scopes) {
      let scope = null;
      try {
        scope = sel === "body" ? d.body : d.querySelector(sel);
      } catch (_) {
        scope = null;
      }
      if (!scope) continue;

      const nodes = scope.querySelectorAll("a, span, label, td, strong, b, font");
      for (const el of nodes) {
        if (el.getAttribute && el.getAttribute(MARK)) continue;
        if (el.closest && el.closest(".sei-notion-trigger, #sei-notion-modal-host")) {
          continue;
        }
        const text = compactText(el);
        if (!text) continue;
        if (text !== nup && text.indexOf(nup) !== 0) continue;
        if (text.length > nup.length + 80) continue;
        if (!best || text.length < best.len) {
          best = { el, len: text.length };
        }
      }
      if (best && sel !== "body") break;
    }
    if (!best) return null;

    const el = best.el;
    const a = el.closest && el.closest("a");
    if (a && compactText(a).length <= nup.length + 80) return a;
    return el;
  }

  function ensureTrigger(anchor) {
    const inside = anchor.querySelector && anchor.querySelector("[" + MARK + "]");
    if (inside) return inside;

    const next = anchor.nextElementSibling;
    if (next && next.getAttribute && next.getAttribute(MARK)) {
      anchor.appendChild(next);
      return next;
    }

    const nearby = anchor.parentElement
      ? anchor.parentElement.querySelector("[" + MARK + "]")
      : null;
    if (nearby) {
      anchor.appendChild(nearby);
      return nearby;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sei-notion-trigger sei-notion-trigger-process";
    btn.setAttribute(MARK, "1");
    btn.textContent = "N";
    btn.setAttribute("aria-label", "Notion");
    anchor.appendChild(btn);
    return btn;
  }

  function paint(doc, processNumber, state) {
    const d = doc || document;

    d.querySelectorAll(".sei-notion-process-host, .sei-notion-card, .sei-notion-create, .sei-notion-fab, #sei-notion-process-btn").forEach(
      (el) => el.remove()
    );

    let anchor = findNumberElement(d, processNumber);
    if (!anchor) {
      try {
        anchor = d.querySelector(
          "#divArvore a, #divArvoreHtml a, .infraArvore a, #divInfraBarraLocalizacao a"
        );
      } catch (_) {
        anchor = null;
      }
    }
    if (!anchor) return;

    const btn = ensureTrigger(anchor);
    const page = pageFor(state.pages, processNumber);
    btn.className = "sei-notion-trigger sei-notion-trigger-process";
    btn.classList.toggle("is-linked", !!page);
    btn.classList.toggle("is-busy", state.creating === processNumber || !!state.loading);
    if (page && page.status) {
      const mappedColor = state.mapping && state.mapping.badgeColorMap && state.mapping.badgeColorMap[page.status.name];
      const color = mappedColor || page.status.color || "default";
      btn.classList.add("status-" + color);
    }
    btn.title =
      state.displayMode === "panel"
        ? page
          ? "Mostrar no painel Notion"
          : "Criar no painel Notion"
        : page
          ? "Abrir página do Notion"
          : "Criar / abrir no Notion";
    btn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (state.onOpen) {
        state.onOpen(
          collectMeta(d, processNumber, {
            page: page || null,
            anchor
          })
        );
      }
    };
  }

  function collectMeta(doc, processNumber, extra) {
    const d = doc || document;
    const nup = String(processNumber || "").trim();
    const more = extra || {};
    const anchor =
      more.anchor || (nup ? findNumberElement(d, nup) : null);
    const meta =
      root.SeiNotionDom.findProcessMeta &&
      root.SeiNotionDom.findProcessMeta(d);
    const labels =
      (root.SeiNotionDom.findLabels && root.SeiNotionDom.findLabels(d)) ||
      (root.SeiNotionDom.markersFromScope &&
        root.SeiNotionDom.markersFromScope(d)) ||
      [];
    const assignee =
      (root.SeiNotionDom.findAssignee && root.SeiNotionDom.findAssignee(d)) ||
      (root.SeiNotionDom.assigneeFromScope &&
        root.SeiNotionDom.assigneeFromScope(d)) ||
      "";
    const processType =
      (root.SeiNotionDom.findProcessType &&
        root.SeiNotionDom.findProcessType(d)) ||
      (meta && meta.processType) ||
      "";
    const due =
      (root.SeiNotionDom.findDue && root.SeiNotionDom.findDue(d)) ||
      (root.SeiNotionDom.dueFromScope &&
        root.SeiNotionDom.dueFromScope(
          anchor && anchor.closest && anchor.closest("tr")
        )) ||
      "";
    const specName =
      (root.SeiNotionDom.findEspecificacao &&
        root.SeiNotionDom.findEspecificacao(d)) ||
      (meta && meta.name) ||
      "";
    const description =
      (root.SeiNotionDom.findNotes && root.SeiNotionDom.findNotes(d)) ||
      (root.SeiNotionDom.notesFromScope &&
        root.SeiNotionDom.notesFromScope(d)) ||
      "";
    return {
      processNumber: nup,
      name: specName,
      description,
      seiUrl:
        (root.SeiNotionDom.processUrl &&
          root.SeiNotionDom.processUrl(d, nup, anchor)) ||
        "",
      labels,
      assignee,
      processType,
      due,
      page: more.page || null
    };
  }

  root.SeiNotionProcessView = { paint, collectMeta };
})(typeof globalThis !== "undefined" ? globalThis : window);
