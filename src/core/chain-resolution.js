import { result } from "./model.js";
import { isNodeUsable, nodeStatePenalty } from "./node-state.js";

const DEFAULT_MAX_DEPTH = 16;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nodeById(nodes) {
  return new Map((Array.isArray(nodes) ? nodes : []).filter((node) => node && node.id).map((node) => [node.id, node]));
}

function groupById(groups) {
  if (groups instanceof Map) return groups;
  if (Array.isArray(groups)) return new Map(groups.filter((group) => group && group.id).map((group) => [group.id, group]));
  return new Map(Object.entries(groups || {}).filter((entry) => entry[1] && entry[1].id).map((entry) => [entry[0], entry[1]]));
}

function latencyOf(node) {
  for (const value of [node && node.latencyMs, node && node.latency, node && node.probe && node.probe.latencyMs, node && node.health && node.health.latencyMs]) {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return Number.POSITIVE_INFINITY;
}

function score(node, states) {
  return latencyOf(node) + nodeStatePenalty(node, states);
}

function deterministicIndex(nodes, key) {
  const textKey = text(key);
  if (!textKey) return 0;
  let hash = 2166136261;
  for (let i = 0; i < textKey.length; i += 1) {
    hash ^= textKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % nodes.length;
}

function needsReselect(groupId, context) {
  const groups = context.healing && context.healing.reselectGroups;
  return groups instanceof Set && groups.has(groupId);
}

function selectMember(group, candidates, context, groupId) {
  const options = group && group.options && typeof group.options === "object" ? group.options : {};
  if (!candidates.length) return null;
  const reselect = needsReselect(groupId, context);
  if (group.type === "select") {
    const selected = reselect ? "" : text(context.selected || options.selected);
    if (selected) return candidates.find((node) => node.id === selected) || null;
    return candidates[0];
  }
  if (group.type === "url_test" || group.type === "region") return candidates.slice().sort((a, b) => score(a, context.states) - score(b, context.states))[0];
  if (group.type === "fallback") return candidates[0];
  if (group.type === "load_balance") {
    const index = reselect ? 0 : (Number.isInteger(context.index) ? Math.abs(context.index) % candidates.length : deterministicIndex(candidates, context.key));
    return candidates[index];
  }
  return null;
}

function resolveGroup(group, context, stack, depth) {
  const id = text(group && group.id);
  if (!id) return result(false, {}, "chain group requires id");
  if (group.enabled === false) return result(false, {}, "chain group is disabled: " + id);
  if (stack.has(id)) return result(false, {}, "chain group cycle detected: " + id);
  if (depth > context.maxDepth) return result(false, {}, "chain resolution depth exceeded");

  const nextStack = new Set(stack);
  nextStack.add(id);
  const candidates = [];
  for (const rawMember of Array.isArray(group.members) ? group.members : []) {
    const memberId = text(rawMember);
    if (!memberId) continue;
    const node = context.nodesById.get(memberId);
    if (node) {
      if (isNodeUsable(node, context.states)) candidates.push(node);
      continue;
    }
    const child = context.groups.get(memberId);
    if (!child) return result(false, {}, "chain group references missing node or group: " + memberId);
    const selected = resolveGroup(child, context, nextStack, depth + 1);
    if (!selected.ok || !selected.data.hop) continue;
    candidates.push(selected.data.hop);
  }

  const unique = [...new Map(candidates.map((node) => [node.id, node])).values()];
  const member = selectMember(group, unique, context, id);
  if (!member) return result(false, {}, "chain group has no usable member: " + id);
  return result(true, { hop: member, source: "group", groupId: id });
}

function resolveHop(hop, context, stack, depth) {
  if (!hop || typeof hop !== "object") return result(false, {}, "invalid chain hop");
  if (depth > context.maxDepth) return result(false, {}, "chain resolution depth exceeded");
  if (Array.isArray(hop.chain)) {
    const chainId = text(hop.id) || "<anonymous>";
    if (stack.has(chainId)) return result(false, {}, "chain cycle detected: " + chainId);
    const nextStack = new Set(stack);
    nextStack.add(chainId);
    return resolveChainInternal(hop.chain, context, nextStack, depth + 1);
  }
  const groupId = text(hop.group || hop.groupId);
  if (groupId) {
    const group = context.groups.get(groupId);
    if (!group) return result(false, {}, "chain group not found: " + groupId);
    return resolveGroup(group, context, stack, depth);
  }
  const id = text(hop.id);
  if (!id) return result(false, {}, "chain hop requires id, group, or nested chain");
  const node = context.nodesById.get(id);
  if (!node) return result(false, {}, "chain node not found: " + id);
  if (!isNodeUsable(node, context.states)) return result(false, {}, "chain node is unavailable: " + id);
  return result(true, { hop: node, source: "node" });
}

function resolveChainInternal(hops, context, stack, depth) {
  if (!Array.isArray(hops) || hops.length < 2) return result(false, {}, "chain requires at least two resolved hops");
  const resolved = [];
  const seenNodes = new Set();
  for (const hop of hops) {
    const selected = resolveHop(hop, context, stack, depth);
    if (!selected.ok) return selected;
    const value = selected.data;
    if (Array.isArray(value.hops)) {
      for (const nested of value.hops) {
        if (!nested || !nested.id) return result(false, {}, "nested chain contains invalid node");
        if (seenNodes.has(nested.id)) return result(false, {}, "duplicate/self chain detected: " + nested.id);
        seenNodes.add(nested.id);
        resolved.push(nested);
      }
      continue;
    }
    const node = value.hop;
    if (!node || !node.id) return result(false, {}, "resolved chain hop has no node id");
    if (seenNodes.has(node.id)) return result(false, {}, "duplicate/self chain detected: " + node.id);
    seenNodes.add(node.id);
    resolved.push(node);
  }
  if (resolved.length < 2) return result(false, {}, "chain requires at least two resolved hops");
  return result(true, { hops: resolved });
}

export function resolveChain(hops, { nodes = [], groups = {}, states, healing, maxDepth = DEFAULT_MAX_DEPTH } = {}) {
  const depth = Number.isInteger(maxDepth) && maxDepth > 0 ? maxDepth : DEFAULT_MAX_DEPTH;
  const context = { nodes, nodesById: nodeById(nodes), groups: groupById(groups), states, healing, maxDepth: depth };
  return resolveChainInternal(hops, context, new Set(), 0);
}
