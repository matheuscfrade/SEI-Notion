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

assert(typeof S.parseDateBr === "function", "exporta parseDateBr");

assert(S.parseDateBr("21/08/2026") === "2026-08-21", "converte dd/mm/aaaa");
assert(S.parseDateBr("1/8/2026") === "2026-08-01", "converte d/m/aaaa com zero pad");
assert(S.parseDateBr("2026-08-21") === "2026-08-21", "aceita ISO yyyy-mm-dd");
assert(
  S.parseDateBr("2026-08-21T15:30:00.000Z") === "2026-08-21",
  "aceita ISO com horário e extrai o dia"
);
assert(S.parseDateBr("") == null, "vazio retorna null");
assert(S.parseDateBr("32/01/2026") == null, "dia inválido retorna null");
assert(S.parseDateBr("31/02/2026") == null, "data inexistente retorna null");
assert(S.parseDateBr("abc") == null, "texto inválido retorna null");

const mapping = { due: "Prazo", title: "Nome", extra: [] };
const types = { due: "date", title: "title" };
const brProps = S.writeProperties(mapping, types, {
  due: "21/08/2026",
  name: "Atividade"
});
assert(
  brProps.Prazo && brProps.Prazo.date && brProps.Prazo.date.start === "2026-08-21",
  "writeProperties grava prazo BR como ISO"
);

// Simula o caminho usado em notion.js ao criar/atualizar atividade
function activityDueIso(due) {
  return (
    S.parseDateBr(due) ||
    (due && /^\d{4}-\d{2}-\d{2}/.test(due) ? due : null)
  );
}
assert(
  activityDueIso("15/03/2026") === "2026-03-15",
  "caminho de atividade aceita data BR preenchida"
);
assert(
  activityDueIso("2026-03-15") === "2026-03-15",
  "caminho de atividade aceita data ISO"
);

if (process.exitCode) {
  console.error("\nAlguns testes falharam.");
} else {
  console.log("\nTodos os testes de parseDateBr passaram.");
}
