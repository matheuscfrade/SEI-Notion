const { createContext, runInContext } = require("vm");
const fs = require("fs");
const path = require("path");

const ctx = createContext({
  globalThis: {},
  URL,
  location: { href: "https://sei.example/sei/controlador.php" },
  document: {
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  }
});
ctx.globalThis = ctx;
runInContext(
  fs.readFileSync(path.join(__dirname, "../shared/schema.js"), "utf8"),
  ctx
);
runInContext(
  fs.readFileSync(path.join(__dirname, "../shared/sei-dom.js"), "utf8"),
  ctx
);
const S = ctx.SeiNotionSchema;
const D = ctx.SeiNotionDom;

function assert(cond, label) {
  if (!cond) {
    console.error("FAIL", label);
    process.exitCode = 1;
  } else {
    console.log("ok", label);
  }
}

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error("FAIL", label, "\n  expected", e, "\n  actual  ", a);
    process.exitCode = 1;
  } else {
    console.log("ok", label);
  }
}

const mapping = {
  ...S.emptyMapping(),
  title: "Especificação",
  processNumber: "Número SEI",
  processType: "Tipo de processo",
  status: "Status",
  labels: "Marcadores",
  assignee: "Responsável",
  due: "Prazo",
  seiUrl: "URL SEI",
  notes: "Observações",
  extra: ["Prioridade"],
  hiddenRoles: ["due"]
};

assert(typeof S.listColumns === "function", "listColumns exportada");
assert(typeof S.formatListCell === "function", "formatListCell exportada");
assert(typeof S.filterProcesses === "function", "filterProcesses exportada");
assertEqual(S.EXTERNAL_PROCESS_TYPE, "Externo ao SEI", "rótulo de tipo externo");

const cols = S.listColumns(mapping);
assertEqual(
  cols.slice(0, 3).map((c) => c.role + ":" + c.label),
  ["title:Título", "status:Status", "processType:Tipo de processo"],
  "primeiras colunas são Título, Status e Tipo de processo"
);
assert(
  !cols.some((c) => c.role === "processNumber"),
  "Número SEI não entra na listagem"
);
assert(
  cols.some((c) => c.role === "due" && c.label === "Prazo"),
  "Prazo entra na listagem para o filtro da coluna"
);
assertEqual(
  cols.map((c) => c.role || c.name).slice(0, 4),
  ["title", "status", "processType", "due"],
  "ordem Título, Status, Tipo, Prazo"
);
assertEqual(S.listFilterKind({ role: "title" }), "text", "título é busca textual");
assertEqual(S.listFilterKind({ role: "status" }), "select", "status é select");
assertEqual(
  S.listFilterKind({ role: "processType" }),
  "select",
  "tipo é select"
);
assertEqual(S.listFilterKind({ role: "due" }), "date", "prazo é data");
assertEqual(
  S.listFilterKind({ kind: "extra", name: "Prioridade" }),
  "text",
  "extra é busca textual"
);
assertEqual(
  S.maskDateBr("31122024"),
  "31/12/2024",
  "máscara de prazo dd/mm/aaaa"
);
assertEqual(S.maskDateBr("31/12"), "31/12", "máscara parcial de prazo");
assert(
  cols.some((c) => c.role === "labels" && c.label === "Marcadores"),
  "Marcadores visível no popup entra na listagem"
);
assert(
  cols.some((c) => c.kind === "extra" && c.name === "Prioridade"),
  "coluna extra marcada para mostrar entra na listagem"
);
assert(
  cols.some((c) => c.role === "notes"),
  "Observações do popup entra na listagem"
);

const seiPage = {
  pageId: "sei-1",
  title: "Contrato de limpeza",
  processNumber: "23123.000001/2024-01",
  processType: "Contrato",
  status: { name: "Em andamento", color: "blue" },
  labels: [{ name: "Urgente" }],
  assignee: "ana.silva",
  due: "2024-12-31",
  seiUrl: "https://sei.example/p/1",
  notes: "Ver edital",
  extra: { Prioridade: "Alta" }
};
const internalPage = {
  pageId: "int-1",
  title: "Rotina da equipe",
  processNumber: "",
  processType: "",
  status: { name: "A fazer", color: "gray" },
  labels: [],
  assignee: "",
  due: null,
  extra: { Prioridade: false }
};

assertEqual(
  S.formatListCell(seiPage, { role: "title" }),
  "Contrato de limpeza",
  "célula de título"
);
assertEqual(
  S.formatListCell(seiPage, { role: "status" }),
  "Em andamento",
  "célula de status"
);
assertEqual(
  S.formatListCell(seiPage, { role: "processType" }),
  "Contrato",
  "tipo SEI usa o valor do Notion"
);
assertEqual(
  S.formatListCell(internalPage, { role: "processType" }),
  "Externo ao SEI",
  "fora do SEI mostra sempre Externo ao SEI"
);
assertEqual(
  S.formatListCell(seiPage, { role: "labels" }),
  "Urgente",
  "marcadores juntos"
);
assertEqual(
  S.formatListCell(seiPage, { kind: "extra", name: "Prioridade" }),
  "Alta",
  "extra de texto"
);
assertEqual(
  S.formatListCell(internalPage, { kind: "extra", name: "Prioridade" }),
  "Não",
  "extra checkbox falso vira Não"
);
assertEqual(
  S.formatListCell(seiPage, { role: "due" }),
  "31/12/2024",
  "prazo em data BR"
);

const pages = [seiPage, internalPage];
assertEqual(S.filterProcesses(pages, "all").length, 2, "filtro todos");
assertEqual(
  S.filterProcesses(pages, "sei").map((p) => p.pageId),
  ["sei-1"],
  "filtro Processos SEI"
);
assertEqual(
  S.filterProcesses(pages, "external").map((p) => p.pageId),
  ["int-1"],
  "filtro Processos fora do SEI"
);

assert(typeof S.listFilterOptions === "function", "listFilterOptions exportada");
assertEqual(
  S.listFilterOptions(pages, { role: "status" }),
  ["A fazer", "Em andamento"],
  "opções de status ordenadas"
);
assertEqual(
  S.listFilterOptions(pages, { role: "processType" }),
  ["Contrato", "Externo ao SEI"],
  "opções de tipo incluem Externo ao SEI"
);

assertEqual(
  S.filterProcesses(pages, { kind: "all", status: "Em andamento" }).map(
    (p) => p.pageId
  ),
  ["sei-1"],
  "filtro por status"
);
assertEqual(
  S.filterProcesses(pages, {
    kind: "all",
    processType: "Externo ao SEI"
  }).map((p) => p.pageId),
  ["int-1"],
  "filtro por tipo externo"
);
assertEqual(
  S.filterProcesses(pages, { kind: "all", due: "2024-12-31" }).map(
    (p) => p.pageId
  ),
  ["sei-1"],
  "filtro por prazo ISO"
);
assertEqual(
  S.filterProcesses(pages, {
    kind: "all",
    fields: { "role:due": "31/12/2024" },
    columns: cols
  }).map((p) => p.pageId),
  ["sei-1"],
  "filtro de prazo em dd/mm/aaaa"
);
assertEqual(
  S.filterProcesses(pages, {
    kind: "all",
    fields: { "role:due": "31/12" },
    columns: cols
  }).length,
  2,
  "prazo incompleto ainda não filtra"
);
assertEqual(
  S.filterProcesses(pages, {
    kind: "all",
    fields: { "role:title": "limpeza" },
    columns: cols
  }).map((p) => p.pageId),
  ["sei-1"],
  "filtro textual no título"
);
assertEqual(
  S.filterProcesses(pages, {
    kind: "all",
    fields: { "extra:Prioridade": "alta" },
    columns: cols
  }).map((p) => p.pageId),
  ["sei-1"],
  "busca textual na coluna extra"
);
assertEqual(
  S.filterProcesses(pages, {
    kind: "all",
    fields: { "role:title": "andamento" },
    columns: cols
  }).length,
  0,
  "filtro do título não usa o status"
);
assertEqual(
  S.filterProcesses(pages, {
    kind: "sei",
    fields: { "role:title": "rotina" },
    columns: cols
  }).length,
  0,
  "busca textual respeita o filtro SEI/externo"
);

assert(typeof D.findListToolbar === "function", "findListToolbar exportada");

const toolbar = { id: "divInfraBarraComandos", tagName: "DIV" };
const withBar = {
  querySelector(sel) {
    if (sel === "#divInfraBarraComandos") return toolbar;
    return null;
  }
};
assert(
  D.findListToolbar(withBar) === toolbar,
  "acha #divInfraBarraComandos"
);

const classBar = { id: "x", className: "infraBarraComandos", tagName: "DIV" };
const withClass = {
  querySelector(sel) {
    if (sel === ".infraBarraComandos") return classBar;
    return null;
  }
};
assert(
  D.findListToolbar(withClass) === classBar,
  "acha .infraBarraComandos"
);

const emptyDoc = {
  querySelector() {
    return null;
  }
};
assertEqual(D.findListToolbar(emptyDoc), null, "sem barra retorna null");

if (process.exitCode) console.error("test-list-columns failed");
else console.log("test-list-columns passed");
