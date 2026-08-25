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
  fs.readFileSync(path.join(__dirname, "../shared/sei-dom.js"), "utf8"),
  ctx
);
const D = ctx.SeiNotionDom;

function node(attrs) {
  const el = {
    getAttribute(name) {
      if (attrs[name] == null) return null;
      return String(attrs[name]);
    },
    textContent: attrs.textContent || "",
    className: attrs.className || "",
    id: attrs.id || "",
    outerHTML: attrs.outerHTML || "",
    parentElement: null,
    closest() {
      return this.parentElement;
    }
  };
  return el;
}

function scope(nodes) {
  return {
    querySelectorAll() {
      return nodes;
    }
  };
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

const img = node({
  src: "svg/marcador.svg",
  className: "imagemStatus"
});
const anchor = node({
  href: "#ancAndamentoMarcador99",
  id: "ancAndamentoMarcador99",
  onmouseover: "return infraTooltipMostrar('Urgente','Marcador');"
});
img.parentElement = anchor;
assertEqual(
  D.markersFromScope(scope([anchor, img])),
  ["Urgente"],
  "SEI 4: nome no 1º arg, rótulo no 2º, tooltip no <a>"
);

const reversed = node({
  href: "controlador.php?acao=andamento_marcador_gerenciar&id_procedimento=1",
  onmouseover: "return infraTooltipMostrar('Marcador','Prioritário');"
});
assertEqual(
  D.markersFromScope(scope([reversed])),
  ["Prioritário"],
  "tooltip invertido (rótulo, nome)"
);

const withPrazo = node({
  src: "imagens/marcador.gif",
  onmouseover:
    "return infraTooltipMostrar('Férias (Prazo: 21/08/2026)\\n\\nVer despacho','Marcador');"
});
assertEqual(
  D.markersFromScope(scope([withPrazo])),
  ["Férias"],
  "nome + prazo no tooltip; descarta observação"
);

const toolbar = node({
  href: "controlador.php?acao=andamento_marcador_gerenciar",
  title: "Gerenciar Marcadores",
  src: "svg/marcador.svg"
});
assertEqual(
  D.markersFromScope(scope([toolbar])),
  [],
  "botão da barra não vira marcador"
);

const two = [
  node({
    href: "#ancAndamentoMarcador1",
    onmouseover: "return infraTooltipMostrar('Urgente','Marcador');"
  }),
  node({
    href: "#ancAndamentoMarcador2",
    onmouseover: "return infraTooltipMostrar('Pessoal','Marcador');"
  })
];
assertEqual(
  D.markersFromScope(scope(two)),
  ["Urgente", "Pessoal"],
  "vários ícones na mesma linha"
);

if (process.exitCode) {
  console.error("test-markers failed");
} else {
  console.log("test-markers passed");
}
