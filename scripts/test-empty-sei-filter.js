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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error("FAIL", label, "expected", expected, "got", actual);
    process.exitCode = 1;
  } else {
    console.log("ok", label);
  }
}

const mapping = { processNumber: "Número SEI" };

const rich = S.processNumberEmptyFilter(mapping, { processNumber: "rich_text" });
assert(
  rich &&
    rich.property === "Número SEI" &&
    rich.rich_text &&
    rich.rich_text.is_empty === true,
  "filtro vazio em rich_text"
);

const title = S.processNumberEmptyFilter(mapping, { processNumber: "title" });
assert(
  title && title.title && title.title.is_empty === true && !title.rich_text,
  "filtro vazio em title"
);

const url = S.processNumberEmptyFilter(mapping, { processNumber: "url" });
assert(
  url && url.url && url.url.is_empty === true,
  "filtro vazio em url"
);

assertEqual(
  S.processNumberEmptyFilter({}, { processNumber: "rich_text" }),
  null,
  "sem coluna Número SEI não filtra"
);

assert(
  S.isInternalProcess(""),
  "sem número é processo interno"
);
assert(
  S.isInternalProcess("   "),
  "número em branco é processo interno"
);
assert(
  !S.isInternalProcess("23123.000001/2024-01"),
  "NUP preenchido não é interno"
);
assert(
  S.isInternalProcess("Rotina da equipe"),
  "título sem NUP conta como processo interno"
);

const titledAsNup = S.summarizePage(
  {
    id: "int-title",
    url: "https://notion.so/int-title",
    properties: {
      Nome: {
        type: "title",
        title: [{ plain_text: "Rotina da equipe" }]
      }
    }
  },
  { title: "Nome", processNumber: "Nome" }
);
assert(
  S.isInternalProcess(titledAsNup.processNumber),
  "quando Número SEI é o título, nome sem NUP continua interno"
);

const pages = [
  { pageId: "a", processNumber: "23123.000001/2024-01", title: "SEI" },
  { pageId: "b", processNumber: "", title: "Rotina da equipe" }
];

assertEqual(
  S.findPage(pages, { processNumber: "23123.000001/2024-01" }).pageId,
  "a",
  "acha página pelo NUP"
);
assertEqual(
  S.findPage(pages, { pageId: "b" }).pageId,
  "b",
  "acha página interna pelo pageId"
);
assertEqual(
  S.findPage(pages, { processNumber: "" }),
  null,
  "NUP vazio não casa com outra página sem número"
);
assertEqual(
  S.findPage(pages, { processNumber: "", pageId: "b" }).title,
  "Rotina da equipe",
  "pageId vale quando o NUP está vazio"
);

assertEqual(
  S.popupKey({ processNumber: "23123.000001/2024-01" }),
  "nup:23123.000001/2024-01",
  "chave do popup com NUP"
);
assertEqual(
  S.popupKey({ processNumber: "", pageId: "b" }),
  "id:b",
  "chave do popup interno"
);
assertEqual(
  S.popupKey({ processNumber: "", internal: true }),
  "internal-new",
  "chave do rascunho interno"
);

const props = S.writeProperties(
  {
    title: "",
    processNumber: "Número SEI",
    extra: []
  },
  {
    processNumber: "rich_text",
    _titleColumn: "Nome"
  },
  {
    name: "Rotina da equipe",
    processNumber: ""
  }
);
assert(
  props.Nome &&
    props.Nome.title &&
    props.Nome.title[0].text.content === "Rotina da equipe",
  "cria página interna com o título informado"
);
assert(
  props["Número SEI"] &&
    Array.isArray(props["Número SEI"].rich_text) &&
    props["Número SEI"].rich_text.length === 0,
  "grava Número SEI vazio para a listagem encontrar o processo interno"
);

const nupAsTitle = S.writeProperties(
  {
    title: "",
    processNumber: "Número SEI",
    extra: []
  },
  {
    processNumber: "title",
    _titleColumn: "Número SEI"
  },
  {
    name: "Rotina da equipe",
    processNumber: ""
  }
);
assert(
  nupAsTitle["Número SEI"] &&
    nupAsTitle["Número SEI"].title &&
    nupAsTitle["Número SEI"].title[0].text.content === "Rotina da equipe",
  "quando Número SEI é o título, o nome do processo interno permanece no title"
);

const nupTitleSpecInternal = S.writeProperties(
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
    name: "Rotina da equipe",
    processNumber: ""
  }
);
assert(
  nupTitleSpecInternal.Especificação &&
    nupTitleSpecInternal.Especificação.rich_text[0].text.content ===
      "Rotina da equipe",
  "especificação do interno vai para rich_text"
);
assert(
  nupTitleSpecInternal["Número SEI"] &&
    nupTitleSpecInternal["Número SEI"].title &&
    nupTitleSpecInternal["Número SEI"].title[0].text.content ===
      "Rotina da equipe",
  "title nativo do interno fica com o nome, não vazio"
);

const renameExisting = S.writeProperties(
  {
    title: "",
    processNumber: "Número SEI",
    extra: []
  },
  {
    processNumber: "title",
    _titleColumn: "Número SEI"
  },
  {
    name: "Novo nome",
    processNumber: "Rotina da equipe"
  }
);
assertEqual(
  renameExisting["Número SEI"].title[0].text.content,
  "Novo nome",
  "renomear extra SEI não regrava o nome antigo como Número SEI"
);

const renameSameColumn = S.writeProperties(
  {
    title: "Nome",
    processNumber: "Nome",
    extra: []
  },
  {
    title: "title",
    processNumber: "title",
    _titleColumn: "Nome"
  },
  {
    name: "Novo nome",
    processNumber: "Rotina da equipe"
  }
);
assertEqual(
  renameSameColumn.Nome.title[0].text.content,
  "Novo nome",
  "renomear extra SEI na coluna título não concatena o nome antigo"
);

if (process.exitCode) console.error("test-empty-sei-filter failed");
else console.log("test-empty-sei-filter passed");
