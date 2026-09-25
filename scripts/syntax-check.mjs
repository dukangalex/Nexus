import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";

const root = process.cwd();
const ignored = new Set([".git", "node_modules"]);
const errors = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else check(full);
  }
}

function check(file) {
  const rel = path.relative(root, file).replaceAll(path.sep, "/");
  const ext = path.extname(file).toLowerCase();
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) errors.push(`${rel}\n${(result.stderr || result.stdout).trim()}`);
    return;
  }
  if (ext === ".json") {
    try { JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (error) { errors.push(`${rel}\n${error.message}`); }
    return;
  }
  if (ext === ".yaml" || ext === ".yml") {
    try { yaml.load(fs.readFileSync(file, "utf8")); }
    catch (error) { errors.push(`${rel}\n${error.message}`); }
  }
}

walk(root);

if (errors.length) {
  console.error(`Syntax validation failed: ${errors.length} file(s)`);
  for (const error of errors) console.error(`\n${error}`);
  process.exit(1);
}

console.log("Syntax validation passed: JS, JSON and YAML files are valid.");
