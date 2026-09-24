import { normalizeNodes } from "./model.js";

export function normalizeConfig(input) {
  if (typeof input === "string") {
    const value = input.trim();
    if (!value) throw new TypeError("configuration text is empty");
    return { source: "text", value };
  }
  if (input && typeof input === "object") return { source: "object", value: structuredClone(input) };
  throw new TypeError("configuration must be text or object");
}

export function limitNodes(nodes, max = null) {
  if (!Array.isArray(nodes)) return [];
  if (max === null || max === undefined) return nodes;
  const limit = Number.isInteger(max) && max > 0 ? max : null;
  return limit === null ? nodes : nodes.slice(0, limit);
}

export function dedupeNodes(nodes, key = "id") {
  if (!Array.isArray(nodes)) return [];
  const seen = new Set();
  return nodes.filter((node) => {
    const value = node && node[key];
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export function normalizeNodeConfig(nodes, max = null) {
  return limitNodes(dedupeNodes(normalizeNodes(nodes)), max);
}
