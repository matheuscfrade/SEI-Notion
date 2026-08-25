const { createContext, runInContext } = require("vm");
const fs = require("fs");
const path = require("path");

const locationHref =
  "https://sei.ifmg.edu.br/sei/controlador.php?acao=procedimento_controlar";
const ctx = createContext({
  globalThis: {},
  URL,
  location: { href: locationHref },
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
  fs.readFileSync(path.join(__dirname, "../shared/sei-dom.js"), "utf8"),
  ctx
);
const D = ctx.SeiNotionDom;
const doc = {
  location: { href: locationHref },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  }
};

const fakeAnchor = {
  getAttribute(n) {
    if (n === "href") {
      return "controlador.php?acao=procedimento_trabalhar&id_procedimento=2822011&id_unidade=10";
    }
    return "";
  },
  href: "https://sei.ifmg.edu.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=2822011&id_unidade=10",
  closest() {
    return null;
  }
};

const jsAnchor = {
  getAttribute(n) {
    if (n === "href") return "#";
    if (n === "onclick") {
      return "infraAbrirJanela('controlador.php?acao=procedimento_trabalhar&id_procedimento=99');";
    }
    return "";
  },
  href: "https://sei.ifmg.edu.br/sei/controlador.php?acao=procedimento_controlar#",
  closest() {
    return null;
  }
};

console.log(
  "id href",
  D.extractIdProcedimento(
    "controlador.php?acao=procedimento_trabalhar&id_procedimento=2822011&id_unidade=10"
  )
);
console.log("from list", D.processUrl(doc, "23123.000123/2024-01", fakeAnchor));
console.log("control current", D.processUrl(doc, "x"));
console.log("isControl", D.isControlListUrl(locationHref));
console.log(
  "work",
  D.isProcessWorkUrl(
    "https://sei.ifmg.edu.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=1"
  )
);
console.log("from onclick", D.processUrl(doc, "x", jsAnchor));
console.log("safe-ish base via work url", D.processUrl({
  location: {
    href: "https://sei.ifmg.edu.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=7"
  },
  querySelector() { return null; },
  querySelectorAll() { return []; }
}, "x"));
