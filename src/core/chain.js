import { ChainModes, result } from "./model.js";

function nodeId(hop) {
  return hop && typeof hop.id === "string" ? hop.id.trim() : "";
}

export function validateChain(mode, hops) {
  if (!Object.values(ChainModes).includes(mode)) {
    return result(false, {}, "unsupported chain mode");
  }
  if (!Array.isArray(hops) || hops.length < 2) {
    return result(false, {}, "chain requires at least two hops");
  }

  const ids = [];
  for (const hop of hops) {
    const id = nodeId(hop);
    if (!id) return result(false, {}, "every chain hop requires a non-empty id");
    if (ids.includes(id)) return result(false, {}, "duplicate/self chain detected: " + id);
    ids.push(id);
  }

  const kinds = hops.map((hop) => hop.kind || "node");
  const expected = {
    [ChainModes.NODE_NODE]: ["node", "node"],
    [ChainModes.NODE_SUB]: ["node", "subscription"],
    [ChainModes.SUB_NODE]: ["subscription", "node"],
    [ChainModes.SUB_SUB]: ["subscription", "subscription"]
  }[mode];

  if (hops.length === 2 && expected && (kinds[0] !== expected[0] || kinds[1] !== expected[1])) {
    return result(false, {}, "chain hop kinds do not match mode");
  }

  return result(true, {
    mode,
    hops: hops.map((hop) => ({ ...hop, id: nodeId(hop), kind: hop.kind || "node" }))
  });
}
