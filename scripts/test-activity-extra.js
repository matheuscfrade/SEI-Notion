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

const schema = {
  properties: {
    Nome: { type: "title" },
    Status: {
      type: "select",
      select: { options: [{ name: "A Fazer" }, { name: "Concluído" }] }
    },
    "Número SEI": { type: "relation", relation: { database_id: "proc-db" } },
    Responsável: { type: "rich_text" },
    Prazo: { type: "date" },
    Ordem: { type: "number" },
    Prioridade: {
      type: "select",
      select: { options: [{ name: "Alta" }, { name: "Baixa" }] }
    },
    Observações: { type: "rich_text" },
    Urgente: { type: "checkbox" }
  }
};

const mapping = {
  title: "Nome",
  status: "Status",
  processRelation: "Número SEI",
  assignee: "Responsável",
  due: "Prazo",
  extra: ["Prioridade", "Observações", "Urgente", "Número SEI", "Ordem", "Nome"]
};

assert(typeof S.extraActivityNames === "function", "extraActivityNames exportada");
assert(typeof S.extraActivityCandidates === "function", "extraActivityCandidates exportada");
assert(typeof S.extraActivityFieldDefs === "function", "extraActivityFieldDefs exportada");

const names = S.extraActivityNames(mapping);
assert(names.indexOf("Prioridade") !== -1, "extra inclui Prioridade marcada");
assert(names.indexOf("Observações") !== -1, "extra inclui Observações marcada");
assert(names.indexOf("Urgente") !== -1, "extra inclui Urgente marcada");
assert(names.indexOf("Número SEI") === -1, "relação do processo não entra como extra");
assert(names.indexOf("Ordem") === -1, "coluna Ordem não entra como extra");
assert(names.indexOf("Nome") === -1, "título mapeado não entra como extra");
assert(names.indexOf("Status") === -1, "status mapeado não entra como extra");

const candidates = S.extraActivityCandidates(schema, mapping);
const candNames = candidates.map((p) => p.name);
assert(candNames.indexOf("Prioridade") !== -1, "candidato Prioridade");
assert(candNames.indexOf("Observações") !== -1, "candidato Observações");
assert(candNames.indexOf("Urgente") !== -1, "candidato Urgente");
assert(candNames.indexOf("Nome") === -1, "candidato omite título");
assert(candNames.indexOf("Status") === -1, "candidato omite status");
assert(candNames.indexOf("Número SEI") === -1, "candidato omite relação");
assert(candNames.indexOf("Ordem") === -1, "candidato omite Ordem");
assert(candNames.indexOf("Responsável") === -1, "candidato omite responsável mapeado");
assert(candNames.indexOf("Prazo") === -1, "candidato omite prazo mapeado");

const defs = S.extraActivityFieldDefs(schema, mapping, []);
assert(
  defs.some((f) => f.name === "Prioridade" && f.type === "select"),
  "def Prioridade select"
);
assert(
  defs.some((f) => f.name === "Urgente" && f.type === "checkbox"),
  "def Urgente checkbox"
);
assert(
  defs.every((f) => f.name !== "Número SEI" && f.name !== "Ordem"),
  "defs omitem relação e Ordem"
);

const emptyMap = {
  title: "Nome",
  status: "Status",
  processRelation: "Número SEI",
  extra: []
};
assert(S.extraActivityNames(emptyMap).length === 0, "extras vazios são opcionais");
assert(
  S.extraActivityFieldDefs(schema, emptyMap, []).length === 0,
  "sem extras marcados, nenhum campo extra"
);

const page = {
  id: "act-1",
  url: "https://notion.so/act-1",
  created_time: "2026-01-01T00:00:00.000Z",
  properties: {
    Nome: { type: "title", title: [{ plain_text: "Analisar edital" }] },
    Status: { type: "select", select: { name: "A Fazer", color: "gray" } },
    "Número SEI": { type: "relation", relation: [{ id: "proc-1" }] },
    Responsável: {
      type: "rich_text",
      rich_text: [{ plain_text: "Ana" }]
    },
    Prazo: { type: "date", date: { start: "2026-04-01" } },
    Ordem: { type: "number", number: 2 },
    Prioridade: { type: "select", select: { name: "Alta", color: "red" } },
    Observações: {
      type: "rich_text",
      rich_text: [{ plain_text: "Ver anexos" }]
    },
    Urgente: { type: "checkbox", checkbox: true }
  }
};

const act = S.summarizeActivity(page, mapping);
assert(act && act.activityId === "act-1", "summarizeActivity devolve id");
assert(act.title === "Analisar edital", "título da atividade");
assert(act.assignee === "Ana", "responsável da atividade");
assert(act.extra && act.extra.Prioridade === "Alta", "extra Prioridade lida");
assert(act.extra.Observações === "Ver anexos", "extra Observações lida");
assert(act.extra.Urgente === true, "extra Urgente lida");
assert(act.extra["Número SEI"] === undefined, "relação não vai para extra");
assert(act.extra.Ordem === undefined, "Ordem não vai para extra");

const actNoExtra = S.summarizeActivity(page, emptyMap);
assert(actNoExtra && (!actNoExtra.extra || Object.keys(actNoExtra.extra).length === 0), "sem extras no mapping, extra vazio");

const written = S.writeProperties(
  { extra: mapping.extra },
  {},
  {
    extra: { Prioridade: "Baixa", Observações: "ok", Urgente: false },
    extraFields: defs
  }
);
assert(written.Prioridade && written.Prioridade.select.name === "Baixa", "grava extra select");
assert(
  written.Observações &&
    written.Observações.rich_text[0].text.content === "ok",
  "grava extra rich_text"
);
assert(written.Urgente && written.Urgente.checkbox === false, "grava extra checkbox");

if (process.exitCode) {
  process.exit(1);
}
console.log("all ok");
