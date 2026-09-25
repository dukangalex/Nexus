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

function nodeTargetMap(nodes, states) {
  const map = new Map();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!usableNode(node, states)) continue;
    const id = String(node.id).trim();
    map.set(id, clean(node.name) || id);
  }
  return map;
}

function compileGroupDefinitions(definitions, nodes, states, kernel) {
  const byId = new Map(definitions.map((group) => [String(group.id).trim(), group]));
  const nodeTargets = nodeTargetMap(nodes, states);
  const active = new Map();
  const resolving = new Set();
  const inactive = new Set();

  function resolveMembers(group) {
    const resolved = [];
    for (const member of requireMembers(group)) {
      if (nodeTargets.has(member)) {
        resolved.push(nodeTargets.get(member));
        continue;
      }
      const child = byId.get(member);
      if (!child) throw new Error("group references missing node or group: " + member);
      if (child.enabled === false) {
        inactive.add(member);
        continue;
      }
      if (resolving.has(member)) throw new Error("group reference cycle: " + member);
      const childMembers = resolve(child);
      if (!childMembers.length) {
        inactive.add(member);
        continue;
      }
      resolved.push(child.kernelTarget);
    }
    return [...new Set(resolved)];
  }

  function resolve(group) {
    const id = String(group.id).trim();
    if (inactive.has(id)) return [];
    if (active.has(id)) return active.get(id).members;
    if (resolving.has(id)) throw new Error("group reference cycle: " + id);
    resolving.add(id);
    const members = resolveMembers(group);
    resolving.delete(id);
    if (!members.length) {
      inactive.add(id);
      return [];
    }
    const record = {
      ...group,
      kernelTarget: kernel === Kernels.MIHOMO ? clean(group.name) || id : id,
      members
    };
    active.set(id, record);
    return members;
  }

  for (const group of definitions) {
    if (!group || group.enabled === false) continue;
    const type = normalizeType(group);
    if (!type) throw new Error("group type is required: " + group.id);
    const members = resolve(group);
    if (!members.length && type !== "region") throw new Error("group has no usable members: " + group.id);
  }

  return { active, inactive };
}

export function compileGroups(groups, kernel, nodes = [], states) {
  const definitions = groupList(groups);
  const output = [];
  const targetMap = new Map();
  const resolved = compileGroupDefinitions(definitions, nodes, states, kernel);

  for (const group of definitions) {
    if (group.enabled === false) continue;
    const id = String(group.id).trim();
    const record = resolved.active.get(id);
    const type = normalizeType(group);
    if (!record) {
      if (type === "region") continue;
      throw new Error("group has no usable members: " + group.id);
    }
    const members = record.members;

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
      targetMap.set(id, compiled.name);
      continue;
    }

    if (kernel === Kernels.SING_BOX) {
      if (!SING_BOX_TYPES.has(type)) throw new Error("unsupported sing-box group type without semantic downgrade: " + type);
      const compiled = {
        type: type === "url_test" ? "urltest" : type === "load_balance" ? "loadbalance" : "selector",
        tag: id,
        outbounds: members,
      };
      copyOptions(compiled, group.options || {}, [
        "url", "interval", "idle_timeout", "tolerance", "interrupt_exist_connections",
        "filter", "exclude", "strategy", "detour",
      ]);
      output.push(compiled);
      targetMap.set(id, id);
      continue;
    }

    if (kernel === Kernels.XRAY) throw new Error("Xray does not support unified group type without semantic downgrade: " + type);
    throw new Error("unsupported kernel for group compilation: " + kernel);
  }

  return { groups: output, targetMap };
}