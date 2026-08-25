/**
 * Superfície do SEI: lista de processos ou processo aberto.
 */
(function (root) {
  const PROCESS_NUMBER_RE =
    /\b\d{5}\.\d{6}\/\d{4}-\d{2}\b|\b\d{4}\.\d{6}\/\d{4}-\d{2}\b|\b\d{7}\.\d{6}\/\d{4}-\d{2}\b/;

  const TABELAS_LISTA =
    "#tblProcessosRecebidos, #tblProcessosGerados, #tblProcessosAtribuido, #tblProcessosDetalhado, #tblProcessosTrabalho";

  function cleanText(el) {
    if (!el) return "";
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function safeUrl(doc) {
    try {
      return ((doc || document).location && (doc || document).location.href) || "";
    } catch (_) {
      return "";
    }
  }

  function getQueryParam(url, name) {
    try {
      const u = new URL(url, location.origin);
      return u.searchParams.get(name);
    } catch (_) {
      const m = String(url).match(new RegExp("[?&]" + name + "=([^&]*)"));
      return m ? decodeURIComponent(m[1]) : null;
    }
  }

  function getAcao(url) {
    return getQueryParam(url, "acao") || "";
  }

  function temTabelasLista(doc) {
    try {
      return !!(doc || document).querySelector(TABELAS_LISTA);
    } catch (_) {
      return false;
    }
  }

  function findProcessNumberInDoc(doc) {
    const d = doc || document;
    const url = safeUrl(d);
    const fromQuery =
      getQueryParam(url, "protocolo") || getQueryParam(url, "num_procedimento") || "";
    const fromQ = String(fromQuery).match(PROCESS_NUMBER_RE);
    if (fromQ) return fromQ[0];

    const scopes = [
      "#divInfraBarraLocalizacao",
      "#divArvoreInformacao",
      "#divInfraAreaTelaD",
      "#divArvore",
      "#divArvoreHtml",
      "title"
    ];
    for (const sel of scopes) {
      try {
        if (sel === "title") {
          const m = String(d.title || "").match(PROCESS_NUMBER_RE);
          if (m) return m[0];
          continue;
        }
        const el = d.querySelector(sel);
        if (!el) continue;
        const m = cleanText(el).match(PROCESS_NUMBER_RE);
        if (m) return m[0];
      } catch (_) {
        /* ignore */
      }
    }

    try {
      const meta = findProcessMeta(d);
      if (meta && meta.processNumber) return meta.processNumber;
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function findProcessNumber(doc) {
    const root = doc || document;
    const docs = [root];
    try {
      if (root.defaultView && root.defaultView.top && root.defaultView.top.document) {
        if (docs.indexOf(root.defaultView.top.document) === -1) {
          docs.push(root.defaultView.top.document);
        }
      }
    } catch (_) {}
    try {
      root.querySelectorAll("iframe, frame").forEach((frame) => {
        try {
          const idoc =
            frame.contentDocument ||
            (frame.contentWindow && frame.contentWindow.document);
          if (idoc && docs.indexOf(idoc) === -1) docs.push(idoc);
        } catch (_) {}
      });
    } catch (_) {}
    for (let i = 0; i < docs.length; i += 1) {
      const nup = findProcessNumberInDoc(docs[i]);
      if (nup) return nup;
    }
    return null;
  }

  function findProcessMeta(doc) {
    const d = doc || document;
    try {
      const scripts = d.scripts || [];
      for (let i = scripts.length - 1; i >= 0; i -= 1) {
        const text = scripts[i] && scripts[i].innerText;
        if (!text || text.indexOf("infraArvoreNo") === -1) continue;
        const m = /ifrVisualizacao","([\d./-]+)","([^"]*)"/.exec(text);
        if (m && PROCESS_NUMBER_RE.test(m[1])) {
          const parsed = parseTipoAndSpec(m[2] || "");
          return {
            processNumber: m[1],
            name: parsed.name || "",
            processType: parsed.processType
          };
        }
        const m2 = /ifrVisualizacao","([\d./-]+)"/.exec(text);
        if (m2 && PROCESS_NUMBER_RE.test(m2[1])) {
          return { processNumber: m2[1], name: "" };
        }
      }
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function unescapeTooltip(s) {
    return String(s || "")
      .replace(/(\\r\\n|\\r|\\n)/g, "\n")
      .replace(/\\&quot;/g, '"')
      .replace(/&quot;/g, '"')
      .replace(/\\'/g, "'")
      .trim();
  }

  function decodeTooltipArgs(onmouseover) {
    if (!onmouseover) return [];
    const args = [];
    const re = /'((?:\\'|[^'])*)'/g;
    let m;
    const raw = String(onmouseover);
    while ((m = re.exec(raw))) {
      args.push(unescapeTooltip(m[1]));
    }
    if (args.length) return args;
    const parts = raw.split("'");
    if (parts.length >= 2) return [unescapeTooltip(parts[1])];
    return [];
  }

  function decodeTooltip(onmouseover) {
    const args = decodeTooltipArgs(onmouseover);
    return args[0] || "";
  }

  const TIPO_STOP_RE =
    /\s+(?:interessad\w*|situa[cç][aã]o|especifica[cç][aã]o|data\s+d[eo]|observa[cç][oõ]es|anota[cç][oõ]es|marcador|protocolo|unidade\s+geradora|usu[aá]rio\s+gerador)\b[\s\S]*$/i;

  function sanitizeProcessType(raw) {
    let t = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    t = t.replace(PROCESS_NUMBER_RE, " ").replace(/\s+/g, " ").trim();
    t = t.replace(TIPO_STOP_RE, "").trim();
    t = t.replace(/^tipo(?:\s+d[eo]\s+processo|\s+d[eo]\s+procedimento)?\s*[:\-–]\s*/i, "");
    t = t.replace(/^[\s\-–—|:]+/, "").replace(/[\s\-–—|:]+$/, "");
    if (t.length > 160) t = t.slice(0, 160).trim();
    return t;
  }

  function isTipoLabel(text) {
    const n = String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[:\-–]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return /^(tipo|tipo do processo|tipo de processo|tipo processo|tipo do procedimento|tipo de procedimento)$/.test(
      n
    );
  }

  function looksLikeProcessType(text) {
    const v = sanitizeProcessType(text);
    if (!v || v.length < 3 || v.length > 160) return false;
    if (isTipoLabel(v)) return false;
    if (/especifica/i.test(v)) return false;
    if (/^https?:/i.test(v)) return false;
    if (/selecione|escolha um/i.test(v)) return false;
    if (/^(despacho|of[ií]cio|anexo|email|parecer)\b/i.test(v)) return false;
    if (/^[\wÀ-ú0-9 ./\-()]{2,50}:\s*\S+/i.test(v)) return true;
    return false;
  }

  function processTypeFromText(text) {
    const chunk = String(text || "");
    const patterns = [
      /tipo(?:\s+d[eo]\s+processo|\s+d[eo]\s+procedimento)?\s*[:\-–]\s*([^\n\r]+)/i
    ];
    for (let i = 0; i < patterns.length; i += 1) {
      const m = chunk.match(patterns[i]);
      if (!m || !m[1]) continue;
      const value = sanitizeProcessType(m[1]);
      if (value.length >= 3 && !isTipoLabel(value)) return value;
    }
    return "";
  }

  function cleanSpecName(raw) {
    if (!raw) return "";
    let s = String(raw || "").replace(/\s+/g, " ").trim();
    if (PROCESS_NUMBER_RE.test(s)) {
      s = s.replace(PROCESS_NUMBER_RE, " ").replace(/\s+/g, " ").trim();
    }
    s = s.replace(/^especifica[cç][aã]o\s*[:\-–]?\s*/i, "").trim();
    if (!s || PROCESS_NUMBER_RE.test(s)) return "";
    return s;
  }

  function parseTipoAndSpec(text) {
    const raw = String(text || "").trim();
    if (!raw) return { processType: "", name: "" };
    let processType = processTypeFromText(raw);
    const specM = raw.match(/especifica[cç][aã]o\s*[:\-–]\s*([^\n\r]+)/i);
    let name = specM ? cleanSpecName(specM[1]) : "";
    if (!processType && looksLikeProcessType(raw) && !specM) {
      processType = sanitizeProcessType(raw);
    }
    if (!name) {
      if (processType && raw !== processType) {
        const without = raw
          .replace(
            /tipo(?:\s+d[eo]\s+processo|\s+d[eo]\s+procedimento)?\s*[:\-–]\s*[^\n\r]+/i,
            ""
          )
          .replace(/\s+/g, " ")
          .trim();
        name = without && without !== processType ? cleanSpecName(without) : "";
      } else if (!processType) {
        name = cleanSpecName(raw);
      }
    }
    return { processType, name: cleanSpecName(name) };
  }

  function processTypeFromTooltip(onmouseover) {
    const args = decodeTooltipArgs(onmouseover);
    if (!args.length) return { processType: "", name: "" };
    let processType = "";
    let name = "";
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i] || "";
      const parsed = parseTipoAndSpec(arg);
      if (!processType && parsed.processType) {
        processType = parsed.processType;
      }
      if (!name && parsed.name) {
        name = parsed.name;
      }
      if (!name && /especifica[cç][aã]o/i.test(arg)) {
        const m = arg.match(/especifica[cç][aã]o\s*[:\-–]?\s*([^\n\r<"';]+)/i);
        if (m && m[1]) name = cleanSpecName(m[1]);
      }
    }
    if (!name && args.length >= 2) {
      for (let i = 0; i < args.length; i += 1) {
        const cleaned = cleanSpecName(args[i]);
        if (cleaned && cleaned !== processType) {
          name = cleaned;
          break;
        }
      }
    }
    return { processType, name: cleanSpecName(name) };
  }

  function parseDateBrToIso(text) {
    const m = String(text || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return "";
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
      return "";
    }
    return (
      String(y) +
      "-" +
      String(mo).padStart(2, "0") +
      "-" +
      String(d).padStart(2, "0")
    );
  }

  function firstDateIso(text) {
    const m = String(text || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? parseDateBrToIso(m[0]) : "";
  }

  function nodeAttrBlob(el) {
    if (!el || !el.getAttribute) return "";
    return [
      el.getAttribute("href"),
      el.getAttribute("src"),
      el.getAttribute("title"),
      el.getAttribute("alt"),
      el.getAttribute("onmouseover"),
      el.getAttribute("onclick"),
      el.className,
      el.id
    ]
      .filter(Boolean)
      .join(" ");
  }

  function isRetornoProgramadoNode(el) {
    const b = nodeAttrBlob(el);
    if (/controle[_ ]?prazo/i.test(b)) return false;
    return /retorno[_ ]?programado|aguardando[_ ]?retorno|para[_ ]?devolver/i.test(b);
  }

  function isControlePrazoNode(el) {
    if (!el || isRetornoProgramadoNode(el)) return false;
    const b = nodeAttrBlob(el) + " " + String((el.outerHTML || "").slice(0, 600));
    return (
      /controle[_ ]?prazos?/i.test(b) ||
      /controle\s+d[eo]\s+prazos?/i.test(b) ||
      /prazo_(andamento|atrasado|concluido|gerenciar)/i.test(b)
    );
  }

  function dueFromElement(el) {
    if (!el) return "";
    const texts = [];
    texts.push(el.getAttribute && el.getAttribute("title"));
    texts.push(el.getAttribute && el.getAttribute("alt"));
    const mouse = el.getAttribute && el.getAttribute("onmouseover");
    if (mouse) {
      texts.push(mouse);
      decodeTooltipArgs(mouse).forEach((a) => texts.push(a));
    }
    texts.push(el.textContent);
    for (let i = 0; i < texts.length; i += 1) {
      const chunk = String(texts[i] || "");
      const labeled = chunk.match(
        /(?:controle\s+d[eo]\s+prazos?|data\s+certa|data(?:\s+m[aá]xima)?|prazo)\s*[:\-–]?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
      );
      if (labeled) {
        const iso = parseDateBrToIso(labeled[1]);
        if (iso) return iso;
      }
      const iso = firstDateIso(chunk);
      if (iso) return iso;
    }
    return "";
  }

  function dueFromText(text) {
    const chunk = String(text || "");
    const ctrl = chunk.match(
      /controle\s+d[eo]\s+prazos?\s*[:\-–]?\s*[^\d]{0,80}(\d{1,2}\/\d{1,2}\/\d{4})/i
    );
    if (ctrl) return parseDateBrToIso(ctrl[1]);
    if (/retorno\s+programado|aguardando\s+retorno/i.test(chunk)) return "";
    const labeled = chunk.match(
      /(?:data\s+certa|data\s+m[aá]xima|vencimento|data\s+limite)\s*[:\-–]?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
    );
    if (labeled) return parseDateBrToIso(labeled[1]);
    return "";
  }

  function dueFromScope(scope) {
    if (!scope) return "";
    try {
      const nodes = scope.querySelectorAll(
        "a, img, span, button, svg, use, [title], [onmouseover], [alt], [href], [src], [aria-label]"
      );
      let i;
      for (i = 0; i < nodes.length; i += 1) {
        if (!isControlePrazoNode(nodes[i])) continue;
        const iso =
          dueFromElement(nodes[i]) ||
          dueFromElement(nodes[i].parentElement) ||
          dueFromElement(nodes[i].closest && nodes[i].closest("a"));
        if (iso) return iso;
      }
      for (i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        if (isRetornoProgramadoNode(el)) continue;
        const blob =
          nodeAttrBlob(el) +
          " " +
          (el.getAttribute && el.getAttribute("aria-label")) +
          " " +
          (el.textContent || "");
        if (
          !/controle\s+d[eo]\s+prazos?|controle[_ ]?prazos?|prazo_(andamento|atrasado|concluido)/i.test(
            blob
          )
        ) {
          continue;
        }
        const iso = dueFromElement(el) || dueFromElement(el.parentElement);
        if (iso) return iso;
      }
      return dueFromText(scope.innerText || scope.textContent || "");
    } catch (_) {
      return "";
    }
  }

  function findProcessTypeInDoc(d) {
    try {
      const selects = d.querySelectorAll(
        "select[name*='Tipo'], select[id*='TipoProcedimento'], select[id*='TipoProcesso'], select[name*='SelTipo'], select[id*='selTipo']"
      );
      for (let i = 0; i < selects.length; i += 1) {
        const sel = selects[i];
        const opt = sel.options && sel.options[sel.selectedIndex];
        if (!opt || !opt.value || /^0*$/.test(opt.value)) continue;
        const value = sanitizeProcessType(cleanText(opt));
        if (value.length >= 3) return value;
      }
    } catch (_) {
      /* ignore */
    }

    try {
      const typed = d.querySelectorAll(
        "[id*='TipoProcedimento'], [id*='TipoProcesso'], [id*='lblTipo'], [id*='spnTipo'], #divTipoProcedimento"
      );
      for (let i = 0; i < typed.length; i += 1) {
        const el = typed[i];
        if (el.tagName === "SELECT") continue;
        const value = sanitizeProcessType(cleanText(el));
        if (value.length >= 3 && !/^tipo$/i.test(value)) return value;
      }
    } catch (_) {
      /* ignore */
    }

    const scopes = [
      "#divArvoreInformacao",
      "#divInfraBarraLocalizacao",
      "#divInfraAreaTelaD",
      "#divProcedimento",
      "#divInformacao",
      "#divInfraAreaDados",
      "#divDadosProcedimento",
      "form[name='frmProcedimento']"
    ];
    for (let i = 0; i < scopes.length; i += 1) {
      try {
        const el = d.querySelector(scopes[i]);
        if (!el) continue;
        const fromText = processTypeFromText(el.innerText || el.textContent || "");
        if (fromText) return fromText;
      } catch (_) {
        /* ignore */
      }
    }

    try {
      const titled = d.querySelectorAll("[onmouseover], [title]");
      for (let i = 0; i < titled.length; i += 1) {
        const el = titled[i];
        const fromTip = processTypeFromTooltip(
          el.getAttribute("onmouseover") || ""
        );
        if (fromTip.processType) return fromTip.processType;
        const titleAttr = el.getAttribute("title") || "";
        const fromTitle = parseTipoAndSpec(titleAttr);
        if (fromTitle.processType) return fromTitle.processType;
        if (looksLikeProcessType(titleAttr)) return sanitizeProcessType(titleAttr);
      }
    } catch (_) {
      /* ignore */
    }

    try {
      const title = String(d.title || "").trim();
      const m = title.match(
        /(\d{5}\.\d{6}\/\d{4}-\d{2}|\d{4}\.\d{6}\/\d{4}-\d{2}|\d{7}\.\d{6}\/\d{4}-\d{2})\s*[\-–—|]\s*(.+)$/
      );
      if (m && m[2]) {
        const value = sanitizeProcessType(m[2].replace(/\s*[-–—]\s*SEI.*$/i, ""));
        if (value.length >= 3 && looksLikeProcessType(value)) return value;
      }
    } catch (_) {
      /* ignore */
    }

    return "";
  }

  function cleanSpecName(raw) {
    if (!raw) return "";
    let s = String(raw || "").replace(/\s+/g, " ").trim();
    s = s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    s = s.replace(/^especifica[cç][aã]o\s*[:\-–]?\s*/i, "").trim();
    if (PROCESS_NUMBER_RE.test(s)) {
      s = s.replace(PROCESS_NUMBER_RE, " ").replace(/\s+/g, " ").trim();
    }
    if (!s || /^(especifica[cç][aã]o|tipo\s+d[eo]\s+processo)$/i.test(s)) return "";
    if (PROCESS_NUMBER_RE.test(s)) return "";
    return s;
  }

  function findEspecificacaoInDoc(doc) {
    const d = doc || document;

    try {
      const selectors = [
        "input[name*='Especificacao']",
        "input[id*='Especificacao']",
        "input[name*='Especificação']",
        "input[id*='Especificação']",
        "#txtEspecificacao",
        "#lblEspecificacao",
        "#divEspecificacao",
        "[id*='spnEspecificacao']",
        "[id*='lblEspecificacao']",
        "[name*='txtEspecificacao']"
      ];
      for (const sel of selectors) {
        const els = d.querySelectorAll(sel);
        for (let i = 0; i < els.length; i += 1) {
          const el = els[i];
          const val = cleanSpecName(
            el.value || el.getAttribute("value") || el.textContent || ""
          );
          if (val) return val;
        }
      }
    } catch (_) {
      /* ignore */
    }

    try {
      const treeAnchors = d.querySelectorAll(
        "#divArvore a, #divArvoreHtml a, .infraArvore a, #span0, a[href*='procedimento_trabalhar'], [onmouseover*='Especifica']"
      );
      for (let i = 0; i < treeAnchors.length; i += 1) {
        const el = treeAnchors[i];
        const tip = el.getAttribute("onmouseover") || el.getAttribute("title") || "";
        const m = tip.match(/especifica[cç][aã]o\s*[:\-–]?\s*([^\n\r<"';]+)/i);
        if (m && m[1]) {
          const val = cleanSpecName(m[1]);
          if (val) return val;
        }
      }
    } catch (_) {
      /* ignore */
    }

    try {
      const labels = d.querySelectorAll("td, th, label, span, div, b, strong");
      for (let i = 0; i < labels.length; i += 1) {
        const el = labels[i];
        const txt = (el.textContent || "").trim();
        if (!/especifica[cç][aã]o/i.test(txt)) continue;

        const m = txt.match(/especifica[cç][aã]o\s*[:\-–]?\s*([^\n\r]+)/i);
        if (m && m[1]) {
          const val = cleanSpecName(m[1]);
          if (val) return val;
        }

        const next = el.nextElementSibling;
        if (next) {
          const input = next.querySelector && next.querySelector("input, textarea");
          const nextVal = input ? (input.value || input.getAttribute("value") || "") : next.textContent;
          const val = cleanSpecName(nextVal);
          if (val) return val;
        }

        if (el.parentElement) {
          const pTxt = el.parentElement.textContent || "";
          const pm = pTxt.match(/especifica[cç][aã]o\s*[:\-–]?\s*([^\n\r]+)/i);
          if (pm && pm[1]) {
            const val = cleanSpecName(pm[1]);
            if (val) return val;
          }
        }
      }
    } catch (_) {
      /* ignore */
    }

    try {
      const nodes = d.querySelectorAll("[onmouseover], [title]");
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        const blob = (el.getAttribute("onmouseover") || "") + " " + (el.getAttribute("title") || "");
        const m = blob.match(/especifica[cç][aã]o\s*[:\-–]?\s*([^\n\r<"';]+)/i);
        if (m && m[1]) {
          const val = cleanSpecName(m[1]);
          if (val) return val;
        }
      }
    } catch (_) {
      /* ignore */
    }

    try {
      const scripts = d.scripts || [];
      for (let i = scripts.length - 1; i >= 0; i -= 1) {
        const text = scripts[i] && scripts[i].innerText;
        if (!text || !/especifica[cç][aã]o/i.test(text)) continue;
        const m = text.match(/especifica[cç][aã]o\s*[:\-–]?\s*([^\n\r<"';\\]+)/i);
        if (m && m[1]) {
          const val = cleanSpecName(m[1]);
          if (val) return val;
        }
      }
    } catch (_) {
      /* ignore */
    }

    return "";
  }

  function findEspecificacao(doc) {
    const root = doc || document;
    const docs = [root];
    try {
      root.querySelectorAll("iframe, frame").forEach((frame) => {
        try {
          const idoc =
            frame.contentDocument ||
            (frame.contentWindow && frame.contentWindow.document);
          if (idoc) docs.push(idoc);
        } catch (_) {
          /* cross-origin */
        }
      });
    } catch (_) {
      /* ignore */
    }
    for (let i = 0; i < docs.length; i += 1) {
      const val = findEspecificacaoInDoc(docs[i]);
      if (val) return val;
    }
    return "";
  }

  function findDue(doc) {
    const root = doc || document;
    const docs = [root];
    try {
      root.querySelectorAll("iframe, frame").forEach((frame) => {
        try {
          const idoc =
            frame.contentDocument ||
            (frame.contentWindow && frame.contentWindow.document);
          if (idoc) docs.push(idoc);
        } catch (_) {
          /* cross-origin */
        }
      });
    } catch (_) {
      /* ignore */
    }
    for (let i = 0; i < docs.length; i += 1) {
      const value = dueFromScope(docs[i]);
      if (value) return value;
    }
    return "";
  }

  function addRelatedDoc(docs, seen, d) {
    if (!d || seen.has(d)) return;
    seen.add(d);
    docs.push(d);
  }

  function relatedDocuments(doc) {
    const root = doc || document;
    const docs = [];
    const seen = new Set();
    addRelatedDoc(docs, seen, root);

    function addFrames(d) {
      if (!d) return;
      try {
        d.querySelectorAll("iframe, frame").forEach((frame) => {
          try {
            const idoc =
              frame.contentDocument ||
              (frame.contentWindow && frame.contentWindow.document);
            addRelatedDoc(docs, seen, idoc);
          } catch (_) {
            /* cross-origin */
          }
        });
      } catch (_) {
        /* ignore */
      }
    }

    addFrames(root);

    try {
      const win = (root.defaultView || window);
      if (win && win.parent && win.parent.document) {
        addRelatedDoc(docs, seen, win.parent.document);
        addFrames(win.parent.document);
      }
    } catch (_) {
      /* ignore */
    }

    try {
      if (window.top && window.top.document) {
        addRelatedDoc(docs, seen, window.top.document);
        addFrames(window.top.document);
      }
    } catch (_) {
      /* ignore */
    }

    return docs;
  }

  function findProcessType(doc) {
    const docs = relatedDocuments(doc || document);
    for (let i = 0; i < docs.length; i += 1) {
      const value = findProcessTypeInDoc(docs[i]);
      if (value) return value;
    }
    return "";
  }

  function extraFromRow(row) {
    const data = {
      name: "",
      description: "",
      labels: [],
      assignee: "",
      processType: "",
      due: ""
    };
    try {
      data.description = notesFromScope(row);
      const proc =
        row.querySelector(
          'a[href*="controlador.php?acao=procedimento_trabalhar"]'
        ) || row.querySelector("a[href*='id_procedimento']");
      if (proc) {
        const parsed = processTypeFromTooltip(proc.getAttribute("onmouseover"));
        data.name = parsed.name;
        data.processType = parsed.processType;
      }
      try {
        const tips = row.querySelectorAll("[onmouseover], [title]");
        for (let i = 0; i < tips.length && !data.processType; i += 1) {
          const el = tips[i];
          const parsed = processTypeFromTooltip(el.getAttribute("onmouseover") || "");
          if (parsed.processType) {
            data.processType = parsed.processType;
            if (!data.name && parsed.name) data.name = parsed.name;
          } else {
            const fromTitle = parseTipoAndSpec(el.getAttribute("title") || "");
            if (fromTitle.processType) data.processType = fromTitle.processType;
          }
        }
      } catch (_) {
        /* ignore */
      }
      if (!data.processType) {
        data.processType =
          processTypeFromText(data.description) ||
          processTypeFromText(row.getAttribute("title") || "");
      }
      data.due = dueFromScope(row);
      data.labels = markersFromScope(row);
      data.assignee = assigneeFromScope(row);
    } catch (_) {
      /* ignore */
    }
    return data;
  }

  function isMarkerLabel(text) {
    const n = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!n) return true;
    if (/sei-notion/i.test(n)) return true;
    return /^(marcador(es)?|gerenciar\s+marcadores?|gerenciar\s+marcador|andamento\s+marcador|pesquisar\s+marcador(es)?)$/i.test(
      n
    );
  }

  function cleanMarkerName(raw) {
    let t = String(raw || "")
      .replace(/\\&quot;/g, '"')
      .replace(/&quot;/g, '"')
      .trim();
    if (!t) return "";
    t = t.split(/\r?\n/)[0].replace(/\s+/g, " ").trim();
    t = t.replace(/^marcador(es)?\s*[:\-–]\s*/i, "");
    t = t.replace(/\s*\(\s*prazo\s*:\s*\d{1,2}\/\d{1,2}\/\d{4}\s*\)\s*$/i, "");
    if (!t || isMarkerLabel(t)) return "";
    if (PROCESS_NUMBER_RE.test(t) || /\d{4,7}\.\d{6}\/\d{4}-\d{2}/.test(t)) return "";
    if (t.length >= 80) return "";
    if (/^gerenciar\s+marcador/i.test(t)) return "";
    return t;
  }

  function markerNamesFromTooltip(onmouseover) {
    const args = decodeTooltipArgs(onmouseover || "");
    if (!args.length) return [];
    const a0 = args[0] || "";
    const a1 = args[1] || "";
    if (args.length >= 2 && isMarkerLabel(a0) && !isMarkerLabel(a1)) return [a1];
    if (args.length >= 2 && isMarkerLabel(a1) && !isMarkerLabel(a0)) return [a0];
    return [a0];
  }

  function isMarkerNode(el) {
    if (!el) return false;
    const blob =
      nodeAttrBlob(el) +
      " " +
      String((el.getAttribute && el.getAttribute("aria-label")) || "") +
      " " +
      String((el.outerHTML || "").slice(0, 400));
    return /marcador/i.test(blob);
  }

  function markersFromScope(scope) {
    if (!scope) return [];
    const names = [];
    const add = (raw) => {
      const n = cleanMarkerName(raw);
      if (n && names.indexOf(n) === -1) names.push(n);
    };
    const addFromEl = (el) => {
      if (!el || !el.getAttribute) return;
      markerNamesFromTooltip(el.getAttribute("onmouseover")).forEach(add);
      add(el.getAttribute("title"));
      add(el.getAttribute("alt"));
      add(el.getAttribute("aria-label"));
      if ((el.textContent || "").trim().length < 60) add(el.textContent);
    };
    try {
      const nodes = scope.querySelectorAll(
        "a, img, span, button, svg, use, [title], [onmouseover], [alt], [href], [src], [id]"
      );
      for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        if (!isMarkerNode(el)) continue;
        addFromEl(el);
        addFromEl(el.parentElement);
        addFromEl(el.closest && el.closest("a"));
      }
    } catch (_) {
      /* ignore */
    }
    return names;
  }

  function collectDocs(doc) {
    const root = doc || document;
    const docs = [];

    function addDoc(d) {
      if (d && docs.indexOf(d) === -1) {
        docs.push(d);
        try {
          d.querySelectorAll("iframe, frame").forEach((frame) => {
            try {
              const idoc =
                frame.contentDocument ||
                (frame.contentWindow && frame.contentWindow.document);
              if (idoc && docs.indexOf(idoc) === -1) docs.push(idoc);
            } catch (_) {
              /* cross-origin */
            }
          });
        } catch (_) {
          /* ignore */
        }
      }
    }

    addDoc(root);
    try {
      if (root.defaultView && root.defaultView.top && root.defaultView.top.document) {
        addDoc(root.defaultView.top.document);
      }
    } catch (_) {
      /* ignore */
    }

    return docs;
  }

  function findLabels(doc) {
    const names = [];
    const docs = collectDocs(doc);
    for (let i = 0; i < docs.length; i += 1) {
      const found = markersFromScope(docs[i]);
      for (let j = 0; j < found.length; j += 1) {
        if (names.indexOf(found[j]) === -1) names.push(found[j]);
      }
    }
    return names;
  }

  function notesFromScope(scope) {
    if (!scope) return "";
    const parts = [];
    const isGenericNote = (s) =>
      /^(anota[cç][aã]o|anota[cç][oõ]es|coment[aá]rio|coment[aá]rios|observa[cç][aã]o|observa[cç][oõ]es|ver\s+anota[cç][oõ]es?|incluir\s+anota[cç][aã]o)$/i.test(
        s
      );
    const add = (raw) => {
      const t = String(raw || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!t || t.length < 2) return;
      if (isGenericNote(t)) return;
      if (parts.indexOf(t) === -1) parts.push(t);
    };
    const addFromEl = (el) => {
      if (!el) return;
      const args = decodeTooltipArgs(el.getAttribute("onmouseover") || "");
      if (args.length >= 2 && /anota|coment/i.test(args[0])) add(args[1]);
      else args.forEach(add);
      const title = el.getAttribute("title") || "";
      if (title && !isGenericNote(title)) add(title);
    };
    try {
      scope
        .querySelectorAll(
          'a[href*="anotacao"], a[href*="comentario"], img[src*="anotacao"], img[src*="comentario"], [title*="Anotação"], [title*="Anotacao"], [title*="Comentário"], [title*="Comentario"]'
        )
        .forEach(addFromEl);
    } catch (_) {
      /* ignore */
    }
    return parts.join("\n\n");
  }

  function loginFromParens(text) {
    const m = String(text || "").match(/\(([A-Za-z][A-Za-z0-9._-]{1,40})\)/);
    return m ? m[1] : "";
  }

  function cleanAssignee(raw) {
    return String(raw || "")
      .replace(/[()]/g, " ")
      .replace(/^[\s:.\-–—]+/, "")
      .replace(/^(?:para|a)\s+/i, "")
      .replace(/^[\s:.\-–—]+/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function assigneeFromTitle(el) {
    if (!el || !el.getAttribute) return "";
    const title = el.getAttribute("title") || el.getAttribute("alt") || "";
    const m = title.match(
      /atribu[íi]d[oa](?:\s+(?:para|a))?\s*[:\-]?\s*(.+)$/i
    );
    if (m) return cleanAssignee(m[1]);
    return "";
  }

  function assigneeFromScope(scope) {
    if (!scope) return "";
    try {
      const proc = scope.querySelector(
        'a[href*="procedimento_trabalhar"], a[class^="processo"], a.protocoloNormal'
      );
      if (proc) {
        let n = proc.nextSibling;
        for (let i = 0; i < 8 && n; i += 1, n = n.nextSibling) {
          if (n.nodeType === 1) {
            const fromEl = assigneeFromTitle(n) || loginFromParens(n.textContent);
            if (fromEl) return fromEl;
          } else {
            const fromTxt =
              loginFromParens(n.textContent) ||
              cleanAssignee(n.textContent);
            if (
              fromTxt &&
              fromTxt.length >= 2 &&
              fromTxt.length < 40 &&
              !PROCESS_NUMBER_RE.test(fromTxt)
            ) {
              return fromTxt;
            }
          }
        }
        if (proc.parentElement) {
          const full = proc.parentElement.textContent || "";
          const idx = full.indexOf(proc.textContent || "");
          const after =
            idx >= 0
              ? full.slice(idx + String(proc.textContent || "").length, idx + 80)
              : full;
          const fromAfter =
            loginFromParens(after) || cleanAssignee(after);
          if (
            fromAfter &&
            fromAfter.length >= 2 &&
            fromAfter.length < 40 &&
            !PROCESS_NUMBER_RE.test(fromAfter)
          ) {
            return fromAfter;
          }
        }
      }

      const titled = scope.querySelector(
        '[title*="Atribuído"], [title*="Atribuido"], [title*="atribuído"], [title*="atribuido"]'
      );
      const fromTitle = assigneeFromTitle(titled);
      if (fromTitle) return fromTitle;

      const attrLink = scope.querySelector(
        'a[href*="andamento_situacao"], span[class*="tribu"], td[class*="tribu"]'
      );
      if (attrLink) {
        const t =
          loginFromParens(attrLink.textContent) ||
          cleanAssignee(attrLink.textContent);
        if (t && t.length >= 2 && t.length < 40 && !PROCESS_NUMBER_RE.test(t)) {
          return t;
        }
      }
    } catch (_) {
      /* ignore */
    }
    return "";
  }

  function findAssigneeInDoc(doc) {
    const d = doc || document;

    try {
      const treeAnchors = d.querySelectorAll(
        "#divArvore a, #divArvoreHtml a, .infraArvore a, #span0, a[href*='procedimento_trabalhar'], [onmouseover*='Atribu']"
      );
      for (let i = 0; i < treeAnchors.length; i += 1) {
        const el = treeAnchors[i];
        const tip = el.getAttribute("onmouseover") || el.getAttribute("title") || "";
        const m = tip.match(/atribu[íi]d[oa](?:\s+(?:para|a))?\s*[:\-–]?\s*([^\n\r<"';]+)/i) ||
                  tip.match(/atribui[cç][aã]o\s*[:\-–]?\s*([^\n\r<"';]+)/i);
        if (m && m[1]) {
          const val = cleanAssignee(m[1]);
          if (val && val.length >= 2 && val.length < 50 && !PROCESS_NUMBER_RE.test(val)) return val;
        }
      }
    } catch (_) {
      /* ignore */
    }

    try {
      const labels = d.querySelectorAll("td, th, label, span, div, b, strong, p");
      for (let i = 0; i < labels.length; i += 1) {
        const el = labels[i];
        const txt = (el.textContent || "").trim();
        if (!/atribu[íi]d[oa]|atribui[cç][aã]o/i.test(txt)) continue;

        const m = txt.match(/atribu[íi]d[oa](?:\s+(?:para|a))?\s*[:\-–]?\s*([^\n\r]+)/i) ||
                  txt.match(/atribui[cç][aã]o\s*[:\-–]?\s*([^\n\r]+)/i);
        if (m && m[1]) {
          const val = cleanAssignee(m[1]);
          if (val && val.length >= 2 && val.length < 50 && !PROCESS_NUMBER_RE.test(val)) return val;
        }

        const next = el.nextElementSibling;
        if (next) {
          const input = next.querySelector && next.querySelector("input, textarea");
          const nextVal = input ? (input.value || input.getAttribute("value") || "") : next.textContent;
          const val = cleanAssignee(nextVal);
          if (val && val.length >= 2 && val.length < 50 && !PROCESS_NUMBER_RE.test(val)) return val;
        }
      }
    } catch (_) {
      /* ignore */
    }

    try {
      const titled = d.querySelectorAll("[onmouseover], [title], [alt]");
      for (let i = 0; i < titled.length; i += 1) {
        const el = titled[i];
        const blob = (el.getAttribute("onmouseover") || "") + " " + (el.getAttribute("title") || "") + " " + (el.getAttribute("alt") || "");
        const m = blob.match(/atribu[íi]d[oa](?:\s+(?:para|a))?\s*[:\-–]?\s*([^\n\r<"';]+)/i);
        if (m && m[1]) {
          const val = cleanAssignee(m[1]);
          if (val && val.length >= 2 && val.length < 50 && !PROCESS_NUMBER_RE.test(val)) return val;
        }
      }
    } catch (_) {
      /* ignore */
    }

    return assigneeFromScope(d);
  }

  function findAssignee(doc) {
    const docs = collectDocs(doc);
    for (let i = 0; i < docs.length; i += 1) {
      const val = findAssigneeInDoc(docs[i]);
      if (val) return val;
    }
    return "";
  }

  function findNotesInDoc(doc) {
    const d = doc || document;
    const parts = [];
    const add = (raw) => {
      const t = String(raw || "").replace(/\s+/g, " ").trim();
      if (!t || t.length < 2) return;
      if (/^(anota[cç][aã]o|coment[aá]rio|observa[cç][aã]o)s?$/i.test(t)) return;
      if (parts.indexOf(t) === -1) parts.push(t);
    };

    try {
      const selectors = [
        "#txtAnotacao",
        "#lblAnotacao",
        "#divAnotacao",
        "textarea[name*='Anotacao']",
        "textarea[name*='Anotação']",
        "[id*='spnAnotacao']",
        "[id*='lblAnotacao']"
      ];
      for (const sel of selectors) {
        const els = d.querySelectorAll(sel);
        for (let i = 0; i < els.length; i += 1) {
          const el = els[i];
          add(el.value || el.getAttribute("value") || el.textContent || "");
        }
      }
    } catch (_) {
      /* ignore */
    }

    const fromScope = notesFromScope(d);
    if (fromScope) add(fromScope);
    return parts.join("\n\n");
  }

  function findNotes(doc) {
    const parts = [];
    const docs = collectDocs(doc);
    for (let i = 0; i < docs.length; i += 1) {
      const val = findNotesInDoc(docs[i]);
      if (val && parts.indexOf(val) === -1) parts.push(val);
    }
    return parts.join("\n\n");
  }

  function matchProcessAnchor(a) {
    if (!a || (a.closest && a.closest(".sei-notion-trigger, #sei-notion-modal-host"))) {
      return null;
    }
    const text = (a.textContent || "").replace(/\s+/g, " ").trim();
    const m = text.match(PROCESS_NUMBER_RE);
    if (!m) return null;
    const href = a.getAttribute("href") || "";
    if (
      !/procedimento_trabalhar|id_procedimento/.test(href) &&
      text.indexOf(m[0]) !== 0
    ) {
      return null;
    }
    return { anchor: a, processNumber: m[0] };
  }

  function findProcessAnchors(doc) {
    const d = doc || document;
    const out = [];
    const tables = d.querySelectorAll(TABELAS_LISTA);
    tables.forEach((scope) => {
      try {
        scope.querySelectorAll("tr").forEach((row) => {
          let found = null;
          row.querySelectorAll("a").forEach((a) => {
            const hit = matchProcessAnchor(a);
            if (!hit) return;
            if (
              !found ||
              /procedimento_trabalhar/.test(hit.anchor.getAttribute("href") || "")
            ) {
              found = hit;
            }
          });
          if (!found) return;
          const extra = extraFromRow(row);
          out.push({
            anchor: found.anchor,
            row,
            processNumber: found.processNumber,
            name: extra.name,
            description: extra.description,
            labels: extra.labels,
            assignee: extra.assignee,
            processType: extra.processType,
            due: extra.due
          });
        });
      } catch (_) {
        /* ignore */
      }
    });
    return out;
  }


  function superficie(doc) {
    const d = doc || document;
    const url = safeUrl(d);
    const acao = getAcao(url);

    if (temTabelasLista(d)) {
      return { kind: "lista", url, acao, processNumber: null };
    }

    if (
      /infra_login|montar_menu|infra_configurar|procedimento_escolher|procedimento_pesquisar/i.test(
        acao
      )
    ) {
      return { kind: "outro", url, acao, processNumber: null };
    }

    const processNumber = findProcessNumber(d);
    const arvore = (() => {
      try {
        return !!d.querySelector(
          "#ifrArvore, #divArvore, #divArvoreHtml, .infraArvore"
        );
      } catch (_) {
        return false;
      }
    })();

    if (
      /procedimento_trabalhar|procedimento_visualizar|arvore_visualizar|procedimento_consultar/i.test(
        acao
      ) ||
      (arvore && processNumber)
    ) {
      return { kind: "processo", url, acao, processNumber };
    }

    return { kind: "outro", url, acao, processNumber };
  }

  function extractIdProcedimento(text) {
    const s = String(text || "");
    const m = s.match(/\bid_procedimento=(\d+)/i);
    return m ? m[1] : "";
  }

  function isControlListUrl(url) {
    const s = String(url || "");
    if (/\bid_procedimento=\d+/i.test(s) && /procedimento_trabalhar/i.test(s)) {
      return false;
    }
    return /procedimento_controlar/i.test(s);
  }

  function isProcessWorkUrl(url) {
    const s = String(url || "");
    return (
      /\bid_procedimento=\d+/i.test(s) &&
      /procedimento_trabalhar|procedimento_visualizar|arvore_visualizar|procedimento_consultar/i.test(
        s
      )
    );
  }

  function controladorBase(doc) {
    const href = safeUrl(doc) || "";
    try {
      const u = new URL(href || location.href);
      if (/controlador\.php/i.test(u.pathname)) return u.origin + u.pathname;
      try {
        const a = (doc || document).querySelector("a[href*='controlador.php']");
        if (a && (a.getAttribute("href") || a.href)) {
          const au = new URL(a.href || a.getAttribute("href"), u);
          if (/controlador\.php/i.test(au.pathname)) return au.origin + au.pathname;
        }
      } catch (_) {
        /* ignore */
      }
      const dir = u.pathname.replace(/\/[^/]*$/, "/") || "/";
      return u.origin + dir + "controlador.php";
    } catch (_) {
      return "";
    }
  }

  function buildWorkUrl(doc, id) {
    const base = controladorBase(doc);
    if (!base || !id) return "";
    return (
      base +
      "?acao=procedimento_trabalhar&id_procedimento=" +
      encodeURIComponent(id)
    );
  }

  function canonicalizeWorkUrl(url) {
    try {
      const u = new URL(url);
      const id = u.searchParams.get("id_procedimento");
      if (!id) return u.origin + u.pathname + u.search;
      return (
        u.origin +
        u.pathname +
        "?acao=procedimento_trabalhar&id_procedimento=" +
        encodeURIComponent(id)
      );
    } catch (_) {
      return String(url || "");
    }
  }

  function idFromDom(doc) {
    const d = doc || document;
    const sels = [
      "input[name='hdnIdProcedimento']",
      "input[name='id_procedimento']",
      "input#hdnIdProcedimento",
      "[data-id-procedimento]"
    ];
    for (let i = 0; i < sels.length; i += 1) {
      try {
        const el = d.querySelector(sels[i]);
        if (!el) continue;
        const val = String(
          el.value ||
            el.getAttribute("data-id-procedimento") ||
            el.getAttribute("value") ||
            ""
        ).trim();
        if (/^\d+$/.test(val)) return val;
      } catch (_) {
        /* ignore */
      }
    }
    return extractIdProcedimento(safeUrl(d));
  }

  function idFromAnchor(anchor) {
    if (!anchor) return "";
    const blob = [
      anchor.getAttribute && anchor.getAttribute("href"),
      anchor.href,
      anchor.getAttribute && anchor.getAttribute("onclick"),
      anchor.getAttribute && anchor.getAttribute("onmousedown")
    ]
      .filter(Boolean)
      .join(" ");
    let id = extractIdProcedimento(blob);
    if (id) return id;
    try {
      const row = anchor.closest && anchor.closest("tr");
      if (row) id = extractIdProcedimento(row.innerHTML || "");
    } catch (_) {
      /* ignore */
    }
    return id || "";
  }

  function processUrl(doc, processNumber, anchor) {
    const d = doc || document;
    const idAnchor = idFromAnchor(anchor);
    if (idAnchor) return buildWorkUrl(d, idAnchor);

    if (anchor && isProcessWorkUrl(anchor.href)) {
      return canonicalizeWorkUrl(anchor.href);
    }

    let id = idFromDom(d) || extractIdProcedimento(safeUrl(d));
    if (!id) {
      try {
        id = extractIdProcedimento(location.href);
      } catch (_) {
        /* ignore */
      }
    }
    if (!id) {
      try {
        const frames = d.querySelectorAll("iframe, frame");
        for (let i = 0; i < frames.length && !id; i += 1) {
          try {
            const idoc =
              frames[i].contentDocument ||
              (frames[i].contentWindow && frames[i].contentWindow.document);
            if (!idoc) continue;
            id =
              idFromDom(idoc) ||
              extractIdProcedimento(
                (idoc.location && idoc.location.href) || ""
              );
          } catch (_) {
            /* ignore */
          }
        }
      } catch (_) {
        /* ignore */
      }
    }
    if (id) return buildWorkUrl(d, id);

    const cur = safeUrl(d);
    if (isProcessWorkUrl(cur)) return canonicalizeWorkUrl(cur);
    try {
      if (isProcessWorkUrl(location.href)) return canonicalizeWorkUrl(location.href);
    } catch (_) {
      /* ignore */
    }
    return "";
  }

  root.SeiNotionDom = {
    PROCESS_NUMBER_RE,
    TABELAS_LISTA,
    getAcao,
    temTabelasLista,
    findProcessNumber,
    findProcessMeta,
    markersFromScope,
    findLabels,
    assigneeFromScope,
    findAssignee,
    findProcessType,
    findEspecificacao,
    dueFromScope,
    findDue,
    notesFromScope,
    findNotes,
    findProcessAnchors,
    superficie,
    processUrl,
    isControlListUrl,
    isProcessWorkUrl,
    extractIdProcedimento
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
