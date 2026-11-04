#!/usr/bin/env node
// seo-optimize/scripts/seo-scan.mjs
//
// CLI for seo-scan-lib.mjs. Subcommands:
//
//   detect  <root> [--workspace]                 stack, versions, docs, routes
//   scan    <root> [--only pillar,..] [--format json|md] [--fail-on sev]
//   html    <file-or-dir>... [--format json|md] [--fail-on sev]
//   fetch   --url <u1,u2,..> [--ua browser,googlebot,gptbot,..|ai] [--compare-ua]
//           [--allow-remote] [--no-probe] [--format json|md] [--fail-on sev]
//
// Output goes to stdout. Exit code 0, or 1 when --fail-on <severity> matches,
// or 2 on usage/runtime errors.

import { parseArgs } from "../../scripts/arg-parse-lib.mjs";
import {
  detectStack, loadProject, routesFor, findWorkspaceApps, scanProject,
  scanHtmlFiles, fetchPages, toMarkdown, summarize, SEVERITY_ORDER, USER_AGENTS,
} from "./seo-scan-lib.mjs";

const USAGE = `usage:
  seo-scan.mjs detect <root> [--workspace]
  seo-scan.mjs scan <root> [--only crawlability,technical,on-page,content,authority,geo] [--format json|md] [--fail-on high]
  seo-scan.mjs html <file-or-dir>... [--format json|md] [--fail-on high]
  seo-scan.mjs fetch --url http://localhost:3000/,http://localhost:3000/blog/x [--ua ai|browser,gptbot,...] [--compare-ua] [--allow-remote] [--no-probe] [--format json|md]`;

function out(result, format) {
  if (format === "md") process.stdout.write(toMarkdown(result) + "\n");
  else process.stdout.write(JSON.stringify({ ...result, summary: summarize(result.findings || []) }, null, 2) + "\n");
}

function exitFor(result, failOn) {
  if (!failOn) return 0;
  const idx = SEVERITY_ORDER.indexOf(String(failOn));
  if (idx < 0) throw new Error(`--fail-on must be one of ${SEVERITY_ORDER.join(", ")}`);
  return (result.findings || []).some((f) => SEVERITY_ORDER.indexOf(f.severity) <= idx) ? 1 : 0;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const format = args.format === "md" ? "md" : "json";

  if (!cmd || cmd === "--help" || cmd === "-h") {
    process.stdout.write(USAGE + "\n");
    return 0;
  }

  if (cmd === "detect") {
    const root = args._[0] || ".";
    if (args.workspace) {
      process.stdout.write(JSON.stringify({ apps: findWorkspaceApps(root) }, null, 2) + "\n");
      return 0;
    }
    const p = loadProject(root);
    const stack = detectStack(p);
    const routes = routesFor(p, stack).map(({ route, file, dynamic, private: priv }) => ({ route, file, dynamic, private: priv }));
    process.stdout.write(JSON.stringify({ root: p.root, stack, routes }, null, 2) + "\n");
    return 0;
  }

  if (cmd === "scan") {
    const root = args._[0] || ".";
    const result = scanProject(root, { only: typeof args.only === "string" ? args.only : null });
    out(result, format);
    return exitFor(result, args["fail-on"]);
  }

  if (cmd === "html") {
    if (!args._.length) throw new Error("html needs at least one file or directory");
    const result = scanHtmlFiles(args._);
    if (!result.pages.length) throw new Error("no .html files found under the given paths");
    out(result, format);
    return exitFor(result, args["fail-on"]);
  }

  if (cmd === "fetch") {
    if (typeof args.url !== "string") throw new Error("fetch needs --url <comma-separated urls>");
    const urls = args.url.split(",").map((s) => s.trim()).filter(Boolean);
    let uas = typeof args.ua === "string" ? args.ua.split(",").map((s) => s.trim()) : ["browser"];
    if (uas.includes("ai") || args["compare-ua"]) {
      uas = ["googlebot", "bingbot", "gptbot", "oai-searchbot", "claudebot", "claude-searchbot", "perplexitybot"];
    }
    for (const u of uas) if (!USER_AGENTS[u]) throw new Error(`unknown --ua ${u}; known: ${Object.keys(USER_AGENTS).join(", ")}`);
    const result = await fetchPages(urls, { uas, allowRemote: !!args["allow-remote"], probe404: !args["no-probe"] });
    out(result, format);
    return exitFor(result, args["fail-on"]);
  }

  throw new Error(`unknown command "${cmd}"\n${USAGE}`);
}

main().then((code) => process.exit(code), (err) => {
  process.stderr.write(`seo-scan: ${err.message}\n`);
  process.exit(2);
});
