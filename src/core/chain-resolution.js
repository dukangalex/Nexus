import { resolveGroupMember } from "./group.js";
import { result } from "./model.js";

const DEFAULT_MAX_DEPTH = 16;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nodeById(nodes) {
  return new Map((Array.isArray(nodes) ? nodes : []).filter((node) => node && node.id).map((node) => [node.id, node]));
}

function groupById(groups) {
  if (groups instanceof Map) return groups;
  if (Array.isArray(groups)) {
    return new Map(groups.filter((group) => group && group.id).map((group) => [group.id, group]));
  }
  return new Map(Object.entries(groups || {}).filter((entry) => entry[1] && entry[1].id).map((entry) => [entry[0], entry[1]]));
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
    const selected = resolveGroupMember(group, context.nodes, context.states, { selected: hop.selected, key: hop.key, index: hop.index });
    if (!selected.ok || !selected.member) return result(false, {}, "chain group has no usable member: " + groupId);
    return result(true, { hop: selected.member, source: "group", groupId });
  }

  const id = text(hop.id);
  if (!id) return result(false, {}, "chain hop requires id, group, or nested chain");
  const node = context.nodesById.get(id);
  if (!node) return result(false, {}, "chain node not found: " + id);
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

export function resolveChain(hops, { nodes = [], groups = {}, states, maxDepth = DEFAULT_MAX_DEPTH } = {}) {
  const depth = Number.isInteger(maxDepth) && maxDepth > 0 ? maxDepth : DEFAULT_MAX_DEPTH;
  const context = { nodes, nodesById: nodeById(nodes), groups: groupById(groups), states, maxDepth: depth };
  return resolveChainInternal(hops, context, new Set(), 0);
}
