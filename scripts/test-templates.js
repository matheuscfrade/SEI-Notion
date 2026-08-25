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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    console.error("FAIL", label, "expected", expected, "got", actual);
    process.exitCode = 1;
  } else {
    console.log("ok", label);
  }
}

const templates = [
  { id: "1", name: "Pessoal: Férias" },
  { id: "2", name: "Contratação" },
  { id: "3", name: "Padrão", isDefault: true }
];

assertEqual(
  S.matchTemplate(templates, "Pessoal: Férias").id,
  "1",
  "match exato pelo tipo SEI"
);
assertEqual(
  S.matchTemplate(templates, "Pessoal: Férias (servidor)").id,
  "1",
  "tipo contém o nome do modelo"
);
assertEqual(
  S.matchTemplate(templates, "Contratação de serviços").id,
  "2",
  "token compartilhado"
);
assertEqual(S.matchTemplate(templates, ""), null, "sem tipo, não força modelo");
assertEqual(
  S.matchTemplate(templates, "Licença capacitação"),
  null,
  "tipo sem modelo correspondente"
);

if (process.exitCode) console.error("test-templates failed");
else console.log("test-templates passed");
