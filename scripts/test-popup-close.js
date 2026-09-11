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

assert(typeof S.badgeBusyNup === "function", "exporta badgeBusyNup");
assert(typeof S.popupCloseIntent === "function", "exporta popupCloseIntent");

assertEqual(
  S.badgeBusyNup({ creating: "23123.000001/2024-01", loading: false }, { isOpen: false }),
  "23123.000001/2024-01",
  "badge pulsa enquanto salva, mesmo com popup fechado"
);
assertEqual(
  S.badgeBusyNup({ creating: null, loading: true }, { isOpen: true, processNumber: "1" }),
  "1",
  "badge pulsa enquanto o popup carrega"
);
assertEqual(
  S.badgeBusyNup({ creating: null, loading: true }, { isOpen: false, processNumber: "1" }),
  "",
  "depois de fechar, loading sozinho não deixa o badge pulsando"
);
assertEqual(
  S.badgeBusyNup({ creating: null, loading: false }, { isOpen: true, processNumber: "1" }),
  "",
  "popup aberto e ocioso: badge parado"
);

const page = { pageId: "abc", processNumber: "1" };
const form = { processNumber: "1", statusName: "Em andamento" };

assertEqual(
  S.popupCloseIntent({
    page,
    form,
    lockedByOther: false,
    heldPageId: "abc",
    lockSession: 3,
    closeSession: 3
  }).persist,
  true,
  "fechar com página existente salva as alterações"
);
assertEqual(
  S.popupCloseIntent({
    page,
    form,
    lockedByOther: false,
    heldPageId: "abc",
    lockSession: 3,
    closeSession: 3
  }).unlock,
  true,
  "fechar libera o bloqueio de edição"
);
assertEqual(
  S.popupCloseIntent({
    page,
    form,
    lockedByOther: false,
    heldPageId: "abc",
    lockSession: 3,
    closeSession: 3
  }).clearBusy,
  true,
  "fechar pede para parar o pulso do badge"
);

assertEqual(
  S.popupCloseIntent({
    page: null,
    form,
    lockedByOther: false,
    heldPageId: null,
    lockSession: 1,
    closeSession: 1
  }).persist,
  false,
  "sem página no Notion, fechar não cria sozinho"
);
assertEqual(
  S.popupCloseIntent({
    page,
    form,
    lockedByOther: true,
    heldPageId: "abc",
    lockSession: 1,
    closeSession: 1
  }).persist,
  false,
  "não sobrescreve se outra pessoa está editando"
);
assertEqual(
  S.popupCloseIntent({
    page,
    form,
    lockedByOther: false,
    heldPageId: "abc",
    currentHeldId: "abc",
    lockSession: 4,
    closeSession: 3
  }).unlock,
  false,
  "não destrava se o processo foi reaberto nesse meio tempo"
);
assertEqual(
  S.popupCloseIntent({
    page,
    form,
    lockedByOther: false,
    heldPageId: "abc",
    currentHeldId: "xyz",
    lockSession: 4,
    closeSession: 3
  }).unlock,
  true,
  "ao trocar de processo, ainda libera o bloqueio do anterior"
);
assertEqual(
  S.popupCloseIntent({
    page,
    form: null,
    lockedByOther: false,
    heldPageId: "abc",
    lockSession: 1,
    closeSession: 1
  }).persist,
  false,
  "sem formulário, só libera o bloqueio"
);

if (process.exitCode) {
  console.error("test-popup-close failed");
} else {
  console.log("test-popup-close passed");
}
