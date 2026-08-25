const { createContext, runInContext } = require("vm");
const fs = require("fs");
const path = require("path");

const ctx = createContext({ globalThis: {} });
ctx.globalThis = ctx;
runInContext(
  fs.readFileSync(path.join(__dirname, "../shared/schema.js"), "utf8"),
  ctx
);
const S = ctx.SeiNotionSchema;

function assert(cond, label) {
  if (!cond) {
    console.error("FAIL", label);
    process.exitCode = 1;
  } else {
    console.log("ok", label);
  }
}

const mapping = {
  title: "Especificação",
  processNumber: "Número SEI",
  processType: "Tipo de processo",
  status: "Status",
  labels: "Marcadores",
  assignee: "Responsável",
  due: "Prazo",
  seiUrl: "URL SEI",
  notes: "Observações",
  extra: []
};
const types = {
  title: "title",
  processNumber: "rich_text",
  processType: "rich_text",
  status: "status",
  labels: "multi_select",
  assignee: "rich_text",
  due: "date",
  seiUrl: "url",
  notes: "rich_text"
};
const data = {
  name: "Pedido de férias",
  processNumber: "23123.000001/2024-01",
  processType: "Pessoal: Férias",
  labels: ["Urgente", "Pessoal"],
  assignee: "Maria Silva",
  due: "2026-08-21",
  seiUrl:
    "https://sei.example/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=1",
  description: "Anotação do SEI"
};

const props = S.writeProperties(mapping, types, data);

assert(
  props["Tipo de processo"] &&
    props["Tipo de processo"].rich_text[0].text.content === "Pessoal: Férias",
  "grava tipo de processo"
);
assert(
  props["Responsável"] &&
    props["Responsável"].rich_text[0].text.content === "Maria Silva",
  "grava responsável"
);
assert(
  props.Marcadores &&
    props.Marcadores.multi_select.map((x) => x.name).join(",") ===
      "Urgente,Pessoal",
  "grava marcadores"
);
assert(props.Prazo && props.Prazo.date.start === "2026-08-21", "grava prazo");
assert(
  props["URL SEI"] && props["URL SEI"].url.indexOf("procedimento_trabalhar") >= 0,
  "grava URL SEI como url"
);

const asLink = S.writeProperties(
  mapping,
  { ...types, seiUrl: "rich_text" },
  data
);
assert(
  asLink["URL SEI"] &&
    asLink["URL SEI"].rich_text[0].text.content === S.SEI_URL_LINK_TEXT &&
    asLink["URL SEI"].rich_text[0].text.link.url.indexOf("procedimento_trabalhar") >=
      0,
  "grava URL SEI como link nomeado"
);

const fromLink = S.summarizePage(
  {
    id: "p1",
    url: "https://notion.so/p1",
    properties: {
      Especificação: {
        type: "title",
        title: [{ plain_text: "Pedido de férias" }]
      },
      "URL SEI": {
        type: "rich_text",
        rich_text: [
          {
            plain_text: S.SEI_URL_LINK_TEXT,
            href: data.seiUrl,
            text: { content: S.SEI_URL_LINK_TEXT, link: { url: data.seiUrl } }
          }
        ]
      }
    }
  },
  mapping
);
assert(
  fromLink.seiUrl === data.seiUrl,
  "lê o href do link, não o texto Abrir no SEI"
);
assert(
  props["Observações"] &&
    props["Observações"].rich_text[0].text.content === "Anotação do SEI",
  "grava observações"
);

const asSelect = S.writeProperties(
  mapping,
  { ...types, status: "select", processType: "select", assignee: "select" },
  { ...data, statusName: "Em andamento" }
);
assert(
  asSelect["Tipo de processo"].select.name === "Pessoal: Férias",
  "tipo como select"
);
assert(asSelect["Responsável"].select.name === "Maria Silva", "responsável como select");
assert(asSelect["Status"].select.name === "Em andamento", "status como select");

const asTextStatus = S.writeProperties(
  mapping,
  { ...types, status: "rich_text" },
  { ...data, statusName: "Em andamento" }
);
assert(
  asTextStatus["Status"] &&
    asTextStatus["Status"].rich_text[0].text.content === "Em andamento",
  "status como rich_text"
);

const fromTextStatus = S.summarizePage(
  {
    id: "p1",
    url: "https://notion.so/p1",
    properties: {
      Status: {
        type: "rich_text",
        rich_text: [{ plain_text: "Concluído" }]
      }
    }
  },
  mapping
);
assert(fromTextStatus.status.name === "Concluído", "lê status do rich_text");

const nupIsTitle = S.writeProperties(
  {
    title: "",
    processNumber: "Número SEI",
    processType: "",
    labels: "",
    assignee: "",
    due: "",
    seiUrl: "",
    notes: "",
    extra: []
  },
  {
    processNumber: "title",
    _titleColumn: "Número SEI"
  },
  {
    name: "Pedido de férias",
    processNumber: "23123.000001/2024-01"
  }
);
assert(
  nupIsTitle["Número SEI"] &&
    nupIsTitle["Número SEI"].title &&
    !nupIsTitle["Número SEI"].rich_text &&
    nupIsTitle["Número SEI"].title[0].text.content.indexOf("23123.000001/2024-01") >= 0,
  "Número SEI como title não vai como rich_text"
);

const nupTitleAndSpec = S.writeProperties(
  {
    title: "Especificação",
    processNumber: "Número SEI",
    extra: []
  },
  {
    title: "rich_text",
    processNumber: "title",
    _titleColumn: "Número SEI"
  },
  {
    name: "Pedido de férias",
    processNumber: "23123.000001/2024-01"
  }
);
assert(
  nupTitleAndSpec["Número SEI"].title[0].text.content === "23123.000001/2024-01",
  "title nativo fica com o NUP"
);
assert(
  nupTitleAndSpec["Especificação"].rich_text[0].text.content === "Pedido de férias",
  "especificação em coluna rich_text"
);

const extraMapping = {
  ...S.emptyMapping(),
  processNumber: "Número SEI",
  title: "Especificação",
  extra: ["Status", "Prioridade"]
};
const extraFields = S.extraFieldDefs(
  {
    properties: {
      "Número SEI": { type: "rich_text" },
      Especificação: { type: "title" },
      Status: {
        type: "status",
        status: { options: [{ name: "A fazer" }, { name: "Em andamento" }] }
      },
      Prioridade: {
        type: "select",
        select: { options: [{ name: "Alta" }] }
      }
    }
  },
  extraMapping,
  []
);
assert(
  extraFields.some((f) => f.name === "Status" && f.type === "status"),
  "extra Status sem papel SEI entra no popup"
);
assert(
  extraFields.some((f) => f.name === "Prioridade" && f.type === "select"),
  "extra Prioridade sem papel SEI entra no popup"
);
const popup = S.popupFields(extraMapping);
assert(
  popup.some((f) => f.kind === "extra" && f.name === "Status"),
  "popupFields inclui extra Status"
);
assert(
  popup.some((f) => f.kind === "extra" && f.name === "Prioridade"),
  "popupFields inclui extra Prioridade"
);
assert(
  S.extraFieldDefs({ properties: {} }, extraMapping, []).some(
    (f) => f.name === "Status"
  ),
  "extra sem schema ainda aparece no popup"
);


const hiddenMapping = {
  ...S.emptyMapping(),
  processNumber: "Número SEI",
  title: "Especificação",
  due: "Prazo",
  hiddenRoles: ["due"]
};
const hiddenPopup = S.popupFields(hiddenMapping);
assert(
  hiddenPopup.some((f) => f.role === "title"),
  "popupFields inclui title (não oculto)"
);
assert(
  !hiddenPopup.some((f) => f.role === "due"),
  "popupFields não inclui due (oculto em hiddenRoles)"
);

if (process.exitCode) console.error("test-write-properties failed");
else console.log("test-write-properties passed");
