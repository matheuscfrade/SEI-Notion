const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const packSrc = fs.readFileSync(path.join(__dirname, "pack-store.py"), "utf8");

function assert(cond, label) {
  if (!cond) {
    console.error("FAIL", label);
    process.exitCode = 1;
  } else {
    console.log("ok", label);
  }
}

function tupleStrings(name) {
  const re = new RegExp(name + "\\s*=\\s*\\(([\\s\\S]*?)\\)");
  const m = packSrc.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const includeDirs = tupleStrings("INCLUDE_DIRS");
assert(
  includeDirs.includes("workbench"),
  "INCLUDE_DIRS inclui workbench (tela cheia / nova aba)"
);

const required = [
  "workbench/workbench.html",
  "workbench/boot.js"
];
for (const rel of required) {
  assert(fs.existsSync(path.join(root, rel)), "arquivo no repo: " + rel);
}

const packPy = path.join(__dirname, "pack-store.py").replace(/\\/g, "\\\\");
const py = spawnSync(
  "python",
  [
    "-c",
    [
      "import importlib.util, sys, os",
      "from pathlib import Path",
      "from zipfile import ZipFile",
      "spec = importlib.util.spec_from_file_location('pack_store', r'" + packPy + "')",
      "mod = importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(mod)",
      "tmp_dir = Path(r'" + root.replace(/\\/g, "\\\\") + "') / 'dist-zip'",
      "mod.DIST = tmp_dir",
      "z = mod.build_zip('9.9.9')",
      "with ZipFile(z) as zf: names = set(zf.namelist())",
      "z.unlink(missing_ok=True)",
      "missing = [p for p in " + JSON.stringify(required) + " if p not in names]",
      "print('ZIP_OK' if not missing else 'ZIP_MISSING ' + ','.join(missing))",
      "sys.exit(0 if not missing else 1)"
    ].join("\n")
  ],
  { encoding: "utf8", cwd: root }
);

const out = (py.stdout || "") + (py.stderr || "");
if (py.status !== 0) {
  console.error("FAIL ZIP da loja deve incluir workbench");
  console.error(out.trim());
  process.exitCode = 1;
} else {
  console.log("ok ZIP da loja inclui workbench/workbench.html e boot.js");
}
