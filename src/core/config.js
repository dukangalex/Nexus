export function normalizeConfig(input) {
  if (typeof input === "string") {
    const value = input.trim();
    if (!value) throw new TypeError("configuration text is empty");
    return { source: "text", value };
  }

  if (input && typeof input === "object") {
    return { source: "object", value: structuredClone(input) };
  }

  throw new TypeError("configuration must be text or object");
}

export function limitNodes(nodes, max = 30) {
  if (!Array.isArray(nodes)) return [];
  const limit = Number.isInteger(max) && max > 0 ? max : 30;
  return nodes.slice(0, limit);
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
