#!/usr/bin/env node
/**
 * docs-stale-check
 *
 * Scans `docs/pages/**.md` and `docs/features/**.md`, reads the YAML
 * frontmatter `scope:` list of source-file globs from each, and compares
 * against the working-tree changes (`git diff --name-only HEAD` plus
 * untracked files). If any changed file matches a doc's scope and that
 * doc itself was NOT changed, the doc is "stale" and we print a reminder.
 *
 * Two modes:
 *   - default (CLI):       human-readable output to stdout, exit 0
 *   - --hook (stop hook):  Cursor JSON on stdout with `followup_message`,
 *                          exit 0; silent if nothing is stale.
 *
 * Always exits 0 — this is a reminder, not a blocker.
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, "..");
const HOOK_MODE = process.argv.includes("--hook");

function parseFrontmatter(filePath) {
  let text;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  if (!text.startsWith("---\n") && !text.startsWith("---\r\n")) return null;
  const headerStart = text.indexOf("\n") + 1;
  const headerEnd = text.indexOf("\n---", headerStart);
  if (headerEnd === -1) return null;
  const yaml = text.slice(headerStart, headerEnd);
  const lines = yaml.split(/\r?\n/);
  const fm = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    if (value === "") {
      const list = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        list.push(lines[j].replace(/^\s*-\s+/, "").trim().replace(/^["']|["']$/g, ""));
        j++;
      }
      fm[key] = list;
      i = j - 1;
    } else {
      fm[key] = value.replace(/^["']|["']$/g, "");
    }
  }
  return fm;
}

function listMarkdown(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const n of names) {
    const p = join(dir, n);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      out.push(...listMarkdown(p));
    } else if (n.endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Convert a glob to a regex.
 * Supported:
 *   ?   matches one non-slash char
 *   *   matches any non-slash chars
 *   **  matches any chars including slashes (with optional trailing slash collapsed)
 *   {a,b,c}  alternation
 * Anchored to whole string.
 */
function globToRegex(glob) {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (c === "{") {
      const close = glob.indexOf("}", i);
      if (close === -1) {
        re += "\\{";
      } else {
        const parts = glob.slice(i + 1, close).split(",").map((p) => p.replace(/[.+^$|()\\[\]\\\\/]/g, (s) => "\\" + s));
        re += "(?:" + parts.join("|") + ")";
        i = close;
      }
    } else if (".+^$|()[]\\/".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  re += "$";
  return new RegExp(re);
}

function matchesAnyGlob(path, globs) {
  for (const g of globs) {
    if (globToRegex(g).test(path)) return true;
  }
  return false;
}

function getChangedFiles() {
  try {
    const tracked = execSync("git diff --name-only HEAD", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    let untracked = "";
    try {
      untracked = execSync("git ls-files --others --exclude-standard", {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      // ignore — might not be a git repo or git missing
    }
    return new Set(
      [tracked, untracked]
        .join("\n")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function findStaleDocs() {
  const docPaths = [
    ...listMarkdown(join(ROOT, "docs/pages")),
    ...listMarkdown(join(ROOT, "docs/features")),
  ];
  const changed = getChangedFiles();
  if (changed.size === 0) return { stale: [], changed };

  const stale = [];
  for (const docPath of docPaths) {
    const fm = parseFrontmatter(docPath);
    const scope = Array.isArray(fm?.scope) ? fm.scope : [];
    if (scope.length === 0) continue;

    const docRel = relative(ROOT, docPath).split("\\").join("/");
    const docTouched = changed.has(docRel);
    const matched = [];
    for (const f of changed) {
      if (f === docRel) continue;
      if (matchesAnyGlob(f, scope)) matched.push(f);
    }
    if (matched.length > 0 && !docTouched) {
      stale.push({ doc: docRel, files: matched });
    }
  }
  return { stale, changed };
}

function printHumanReport({ stale, changed }) {
  if (changed.size === 0) {
    console.log("No working-tree changes detected — nothing to check.");
    return;
  }
  if (stale.length === 0) {
    console.log(`Docs in sync. (${changed.size} changed file${changed.size === 1 ? "" : "s"} checked.)`);
    return;
  }
  console.log(`Stale page/feature docs (${stale.length}):`);
  console.log("");
  for (const s of stale) {
    console.log(`  ${s.doc}`);
    const preview = s.files.slice(0, 6);
    for (const f of preview) console.log(`    - ${f}`);
    if (s.files.length > preview.length) {
      console.log(`    - … and ${s.files.length - preview.length} more`);
    }
    console.log("");
  }
  console.log("Update each one's relevant section, bump `last_reviewed`, and add the new ADR under \"Decisions\".");
}

function emitHookOutput({ stale }) {
  if (stale.length === 0) return;
  const lines = stale.map((s) => {
    const preview = s.files.slice(0, 4).join(", ");
    const more = s.files.length > 4 ? `, …${s.files.length - 4} more` : "";
    return `- \`${s.doc}\` (changed: ${preview}${more})`;
  });
  const message = [
    "Docs reminder: the following page/feature docs may be out of date based on the files changed this session.",
    "",
    ...lines,
    "",
    "For each one: update the relevant section so it matches the new behavior, bump `last_reviewed` to today, and add a link to the new ADR under \"Decisions\". If no behavior changed, just bump `last_reviewed` and add the ADR link as an audit trail.",
  ].join("\n");
  process.stdout.write(JSON.stringify({ followup_message: message }) + "\n");
}

const result = findStaleDocs();
if (HOOK_MODE) {
  emitHookOutput(result);
} else {
  printHumanReport(result);
}
process.exit(0);
