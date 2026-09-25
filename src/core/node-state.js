export const NodeStates = Object.freeze({
  DISCOVERED: "discovered",
  NORMALIZED: "normalized",
  VALIDATED: "validated",
  AVAILABLE: "available",
  ACTIVE: "active",
  DEGRADED: "degraded",
  FAILED: "failed",
  DISABLED: "disabled"
});

const TERMINAL = new Set([NodeStates.DISABLED]);
const TRANSITIONS = Object.freeze({
  discovered: new Set(["normalized", "validated", "available", "disabled"]),
  normalized: new Set(["validated", "available", "disabled"]),
  validated: new Set(["available", "active", "degraded", "failed", "disabled"]),
  available: new Set(["active", "degraded", "failed", "disabled"]),
  active: new Set(["available", "degraded", "failed", "disabled"]),
  degraded: new Set(["active", "available", "failed", "disabled"]),
  failed: new Set(["validated", "available", "active", "degraded", "disabled"]),
  disabled: new Set([])
});

function text(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getNodeState(node, states) {
  if (!node || typeof node !== "object") return null;
  const id = node.id;
  if (states instanceof Map) {
    const value = states.get(id);
    if (typeof value === "string") return text(value) || null;
    if (value && typeof value === "object") return text(value.state) || null;
  } else if (states && typeof states === "object" && id !== undefined) {
    const value = states[id];
    if (typeof value === "string") return text(value) || null;
    if (value && typeof value === "object") return text(value.state) || null;
  }
  return text(node.state) || null;
}

export function isNodeUsable(node, states) {
  const state = getNodeState(node, states);
  return Boolean(node && node.id) && state !== NodeStates.FAILED && state !== NodeStates.DISABLED;
}

export function nodeStatePenalty(node, states) {
  return getNodeState(node, states) === NodeStates.DEGRADED ? 5000 : 0;
}

export function canTransition(from, to) {
  const source = text(from);
  const target = text(to);
  if (!source || !target || !Object.prototype.hasOwnProperty.call(TRANSITIONS, source)) return false;
  if (source === target) return true;
  if (TERMINAL.has(source)) return false;
  return TRANSITIONS[source].has(target);
}

export function transitionNodeState(node, nextState) {
  if (!node || typeof node !== "object" || !node.id) throw new TypeError("node with id is required");
  const target = text(nextState);
  if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, target)) throw new Error("unsupported node state: " + nextState);
  const current = getNodeState(node) || NodeStates.DISCOVERED;
  if (!canTransition(current, target)) throw new Error("invalid node state transition: " + current + " -> " + target);
  return { ...node, state: target };
}

export function getNodeStateModel() {
  return Object.freeze({
    states: NodeStates,
    transitions: TRANSITIONS
  });
}
