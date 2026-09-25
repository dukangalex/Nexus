import { Kernels } from "./model.js";

const MIHOMO_TYPES = new Set(["select", "url_test", "fallback", "load_balance", "region"]);
const SING_BOX_TYPES = new Set(["select", "url_test", "load_balance"]);
const UNUSABLE_STATES = new Set(["failed", "disabled"]);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function groupList(groups) {
  if (Array.isArray(groups)) return groups.filter((group) => group && group.id);
  if (groups && typeof groups === "object") return Object.values(groups).filter((group) => group && group.id);
  return [];
}

function stateOf(node, states) {
  if (states && typeof states === "object") {
    const explicit = states instanceof Map ? states.get(node.id) : states[node.id];
    if (typeof explicit === "string") return explicit.toLowerCase();
    if (explicit && typeof explicit === "object" && typeof explicit.state === "string") return explicit.state.toLowerCase();
  }
  return clean(node.state).toLowerCase();
}

function usableNode(node, states) {
  return Boolean(node && node.id) && !UNUSABLE_STATES.has(stateOf(node, states));
}

function requireMembers(group) {
  const members = Array.isArray(group.members)
    ? [...new Set(group.members.map(clean).filter(Boolean))]
    : [];
  if (!members.length) throw new Error("group has no usable members: " + group.id);
  return members;
}

function copyOptions(target, options, keys) {
  for (const key of keys) {
    if (options[key] !== undefined) target[key] = clone(options[key]);
  }
  return target;
}

function normalizeType(group) {
  return clean(group.type).toLowerCase();
}

function targetMaps(groups, nodes, kernel, states) {
  const nodeTargets = new Map();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!usableNode(node, states)) continue;
    const id = String(node.id).trim();
    const target = clean(node.name) || id;
    nodeTargets.set(id, target);
  }

  const groupTargets = new Map();
  for (const group of groups) {
    if (!group || !group.id || group.enabled === false) continue;
    groupTargets.set(String(group.id).trim(), kernel === Kernels.MIHOMO ? clean(group.name) || group.id : group.id);
  }

  return { nodeTargets, groupTargets };
}

function resolveMembers(group, maps) {
  return requireMembers(group).map((member) => {
    if (maps.nodeTargets.has(member)) return maps.nodeTargets.get(member);
    if (maps.groupTargets.has(member)) return maps.groupTargets.get(member);
    throw new Error("group references missing node or group: " + member);
  });
}

export function compileGroups(groups, kernel, nodes = [], states) {
  const definitions = groupList(groups);
  const output = [];
  const targetMap = new Map();
  const maps = targetMaps(definitions, nodes, kernel, states);

  for (const group of definitions) {
    if (group.enabled === false) continue;

    const type = normalizeType(group);
    if (!type) throw new Error("group type is required: " + group.id);
    const directNodes = new Map(
      (Array.isArray(nodes) ? nodes : [])
        .filter((node) => node && node.id)
        .map((node) => [String(node.id).trim(), node])
    );
    const usableReferences = requireMembers(group).filter((member) => {
      const node = directNodes.get(member);
      return !node || usableNode(node, states);
    });
    if (!usableReferences.length) {
      if (type === "region") continue;
      throw new Error("group has no usable members: " + group.id);
    }
    const members = [...new Set(resolveMembers({ ...group, members: usableReferences }, maps))];
    if (!members.length) throw new Error("group has no usable members: " + group.id);

    if (kernel === Kernels.MIHOMO) {
      if (!MIHOMO_TYPES.has(type)) throw new Error("unsupported Mihomo group type: " + type);

      const compiled = {
        name: clean(group.name) || group.id,
        type: type === "url_test" ? "url-test" : type === "load_balance" ? "load-balance" : type,
        proxies: members,
      };

      copyOptions(compiled, group.options || {}, [
        "url", "interval", "timeout", "tolerance", "lazy", "disable-udp", "max-failed-times",
        "hidden", "expected-status", "filter", "exclude-filter", "include-all", "include-all-proxies",
      ]);

      output.push(compiled);
      targetMap.set(group.id, compiled.name);
      continue;
    }

    if (kernel === Kernels.SING_BOX) {
      if (!SING_BOX_TYPES.has(type)) throw new Error("unsupported sing-box group type without semantic downgrade: " + type);

      const compiled = {
        type: type === "url_test" ? "urltest" : type === "load_balance" ? "loadbalance" : "selector",
        tag: group.id,
        outbounds: members,
      };

      copyOptions(compiled, group.options || {}, [
        "url", "interval", "idle_timeout", "tolerance", "interrupt_exist_connections",
        "filter", "exclude", "strategy", "detour",
      ]);

      output.push(compiled);
      targetMap.set(group.id, group.id);
      continue;
    }

    if (kernel === Kernels.XRAY) {
      throw new Error("Xray does not support unified group type without semantic downgrade: " + type);
    }

    throw new Error("unsupported kernel for group compilation: " + kernel);
  }

  return { groups: output, targetMap };
}
