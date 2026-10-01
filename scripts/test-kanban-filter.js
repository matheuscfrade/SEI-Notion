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

assert(typeof S.filterActivities === "function", "filterActivities exportada");
assert(typeof S.isActivityOverdue === "function", "isActivityOverdue exportada");
assert(typeof S.isActivityDone === "function", "isActivityDone exportada");

const today = "2026-04-10";
const acts = [
  {
    activityId: "a",
    title: "Analisar edital",
    assignee: "Ana",
    due: "2026-04-01",
    statusName: "A Fazer",
    sortIndex: 2,
    createdTime: "2026-03-01T00:00:00.000Z",
    extra: { Prioridade: "Alta" }
  },
  {
    activityId: "b",
    title: "Assinar contrato",
    assignee: "Bruno",
    due: "2026-04-20",
    statusName: "Em Andamento",
    sortIndex: 0,
    createdTime: "2026-03-02T00:00:00.000Z",
    extra: {}
  },
  {
    activityId: "c",
    title: "Arquivar pasta",
    assignee: "Ana",
    due: "2026-03-01",
    statusName: "Concluído",
    sortIndex: 1,
    createdTime: "2026-03-03T00:00:00.000Z"
  },
  {
    activityId: "d",
    title: "Sem prazo",
    assignee: "",
    due: "",
    statusName: "A Fazer",
    sortIndex: 3,
    createdTime: "2026-03-04T00:00:00.000Z"
  }
];

assert(S.isActivityOverdue(acts[0], today) === true, "prazo passado em aberto está atrasado");
assert(S.isActivityOverdue(acts[1], today) === false, "prazo futuro não está atrasado");
assert(S.isActivityOverdue(acts[2], today) === false, "concluída com prazo passado não está atrasada");
assert(S.isActivityOverdue(acts[3], today) === false, "sem prazo não está atrasada");
assert(S.isActivityOverdue({ due: today, statusName: "A Fazer" }, today) === false, "vence hoje não está atrasada");
assert(S.isActivityDone({ statusName: "Concluído" }) === true, "Concluído conta como feito");
assert(S.isActivityDone({ statusName: "A Fazer" }) === false, "A Fazer não é feito");

const byText = S.filterActivities(acts, { text: "edital" });
assert(byText.length === 1 && byText[0].activityId === "a", "filtro por título");

const byAssignee = S.filterActivities(acts, { text: "ana" });
assert(
  byAssignee.map((x) => x.activityId).sort().join(",") === "a,c",
  "filtro por responsável"
);

const byExtra = S.filterActivities(acts, { text: "alta" });
assert(byExtra.length === 1 && byExtra[0].activityId === "a", "filtro por coluna extra");

const overdue = S.filterActivities(acts, { overdue: true, today });
assert(overdue.length === 1 && overdue[0].activityId === "a", "filtro só em atraso ignora concluídas");

const combo = S.filterActivities(acts, { text: "ana", overdue: true, today });
assert(combo.length === 1 && combo[0].activityId === "a", "texto e atraso combinam");

assert(S.filterActivities(acts, {}).length === 4, "sem filtro devolve todas");
assert(S.filterActivities(acts, { text: "   " }).length === 4, "texto vazio não filtra");

const byImport = S.sortActivities(acts, "import").map((x) => x.activityId).join("");
assert(byImport === "bcad", "ordem de importação / quadro usa sortIndex");

const titled = S.sortActivities(acts, "title");
assert(titled[0].title === "Analisar edital", "primeiro título A–Z");
assert(titled[1].title === "Arquivar pasta", "segundo título A–Z");
assert(titled[2].title === "Assinar contrato", "terceiro título A–Z");
assert(titled[3].title === "Sem prazo", "último título A–Z");

const byDue = S.sortActivities(acts, "due");
assert(byDue[0].activityId === "c", "prazo mais cedo primeiro");
assert(byDue[1].activityId === "a", "segundo prazo");
assert(byDue[2].activityId === "b", "prazo futuro depois");
assert(byDue[3].activityId === "d", "sem prazo no fim");

const defaultSort = S.sortActivities(acts).map((x) => x.activityId).join("");
assert(defaultSort === "bcad", "sortActivities sem modo permanece a ordem do quadro");

if (process.exitCode) process.exit(1);
console.log("all ok");
