/**
 * URL raiz do SEI → padrões de match / permissão.
 */
(function (root) {
  function normalizeSeiSiteInput(input) {
    let raw = String(input || "").trim();
    if (!raw) return null;

    raw = raw.replace(/^["']|["']$/g, "").trim();
    if (!/^https?:\/\//i.test(raw)) {
      raw = "https://" + raw;
    }

    let u;
    try {
      u = new URL(raw);
    } catch (_) {
      return null;
    }

    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;

    const origin = u.origin;
    let path = u.pathname || "/";
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    const baseUrl = path === "/" ? origin : `${origin}${path}`;
    const matchPattern =
      path === "/" || path === ""
        ? `${origin}/*`
        : `${origin}${path}/*`;

    return {
      baseUrl,
      origin,
      matchPattern,
      display: baseUrl
    };
  }

  function parseSeiSites(value) {
    const lines = Array.isArray(value)
      ? value
      : String(value || "")
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);

    const seen = new Set();
    const out = [];
    for (const line of lines) {
      const site = normalizeSeiSiteInput(line);
      if (!site) continue;
      const key = site.matchPattern.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(site);
    }
    return out;
  }

  root.SeiNotionSites = {
    normalizeSeiSiteInput,
    parseSeiSites
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
