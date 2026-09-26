import { NodeStates, getNodeState, isNodeUsable } from "./node-state.js";

const DEFAULTS = Object.freeze({ maxActionsPerCycle: 4, cooldownMs: 30000, minHealthyCandidates: 1 });

function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function normalizeOptions(options = {}) {
  return {
    maxActionsPerCycle: positiveInt(options.maxActionsPerCycle, DEFAULTS.maxActionsPerCycle),
    cooldownMs: Math.max(0, Number.isFinite(Number(options.cooldownMs)) ? Number(options.cooldownMs) : DEFAULTS.cooldownMs),
    minHealthyCandidates: positiveInt(options.minHealthyCandidates, DEFAULTS.minHealthyCandidates)
  };
}

function groupMembers(group) {
  return Array.isArray(group && group.members) ? group.members.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()) : [];
}

export function createHealingPolicy(options = {}) {
  return Object.freeze({ ...normalizeOptions(options) });
}

export function planSelfHealing({ nodes = [], groups = [], states, now = Date.now(), lastActions = new Map(), options = {} } = {}) {
  const policy = normalizeOptions(options);
  const nodeMap = new Map((Array.isArray(nodes) ? nodes : []).filter((node) => node && node.id).map((node) => [String(node.id), node]));
  const groupList = Array.isArray(groups) ? groups : Object.values(groups || {});
  const actions = [];
  const affected = new Set();

  for (const group of groupList) {
    if (!group || !group.id || group.enabled === false) continue;
    const members = groupMembers(group);
    const healthy = members.filter((id) => {
      const node = nodeMap.get(id);
      return node && isNodeUsable(node, states) && getNodeState(node, states) !== NodeStates.DEGRADED;
    });
    const failed = members.filter((id) => {
      const node = nodeMap.get(id);
      return node && !isNodeUsable(node, states);
    });
    if (!failed.length || healthy.length >= policy.minHealthyCandidates) continue;

    const previous = lastActions instanceof Map ? lastActions.get(String(group.id)) : lastActions && lastActions[group.id];
    const lastAt = previous && Number(previous.at);
    if (Number.isFinite(lastAt) && now - lastAt < policy.cooldownMs) continue;

    actions.push({ type: "reselect-group", groupId: String(group.id), reason: "insufficient-healthy-candidates", failedMembers: failed, healthyMembers: healthy, at: now });
    affected.add(String(group.id));
    if (actions.length >= policy.maxActionsPerCycle) break;
  }

  return { actions, affectedGroups: [...affected], nextActions: new Map(actions.map((action) => [action.groupId, { at: action.at }])) };
}

export function chooseHealthy(nodes = [], states) {
  return nodes.filter((node) => isNodeUsable(node, states) && getNodeState(node, states) !== NodeStates.DEGRADED)
    .sort((a, b) => (Number(a.latencyMs) || 9999) - (Number(b.latencyMs) || 9999))[0] || null;
}

export function shouldFailover(failures) {
  return Number(failures) >= 3;
}
