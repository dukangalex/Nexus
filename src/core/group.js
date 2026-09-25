export const GroupTypes = Object.freeze([
  "select",
  "url_test",
  "fallback",
  "load_balance",
  "region"
]);

const VALID_MODES = new Set(GroupTypes);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueMembers(members) {
  const seen = new Set();
  return (Array.isArray(members) ? members : [])
    .map(clean)
    .filter((member) => member && !seen.has(member) && seen.add(member));
}

function normalizeType(type) {
  const value = clean(type).toLowerCase();
  if (!VALID_MODES.has(value)) throw new Error("unsupported group type: " + value);
  return value;
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function createGroup({
  id,
  name,
  type = "select",
  members = [],
  enabled = true,
  options = {},
  metadata = {}
} = {}) {
  const groupId = clean(id);
  const groupName = clean(name);
  if (!groupId) throw new TypeError("group id must be a non-empty string");
  if (!groupName) throw new TypeError("group name must be a non-empty string");

  const normalizedType = normalizeType(type);
  const normalizedMembers = uniqueMembers(members);

  if (normalizedType === "region" && normalizedMembers.length === 0) return null;

  return Object.freeze({
    id: groupId,
    name: groupName,
    type: normalizedType,
    members: Object.freeze(normalizedMembers),
    enabled: enabled !== false,
    options: Object.freeze(clone(options) || {}),
    metadata: Object.freeze(clone(metadata) || {})
  });
}

function stateOf(node, states) {
  if (states && typeof states === "object") {
    const explicit = states[node.id];
    if (typeof explicit === "string") return explicit.toLowerCase();
  }
  return clean(node.state).toLowerCase();
}

function usable(node, states) {
  if (!node || !node.id) return false;
  const state = stateOf(node, states);
  return state !== "failed" && state !== "disabled";
}

export function filterGroupMembers(nodes, states) {
  const source = Array.isArray(nodes) ? nodes : [];
  const seen = new Set();
  return source
    .filter((node) => usable(node, states))
    .map((node) => clean(node.id))
    .filter((id) => id && !seen.has(id) && seen.add(id));
}

export function buildRegionGroups(regionGroups = {}) {
  const result = {};
  for (const [region, members] of Object.entries(regionGroups || {})) {
    const group = createGroup({
      id: "region:" + region,
      name: region,
      type: "region",
      members: Array.isArray(members) ? members.map((node) => node && node.id) : []
    });
    if (group) result[group.id] = group;
  }
  return result;
}

export function buildGroups(definitions = [], nodes = [], states) {
  const nodeById = new Map(
    (Array.isArray(nodes) ? nodes : [])
      .filter((node) => node && node.id)
      .map((node) => [node.id, node])
  );

  const result = {};
  for (const definition of Array.isArray(definitions) ? definitions : []) {
    if (!definition || typeof definition !== "object") continue;
    const requested = uniqueMembers(definition.members);
    const available = requested.filter((id) => {
      const node = nodeById.get(id);
      return node && usable(node, states);
    });
    const group = createGroup({ ...definition, members: available });
    if (group) result[group.id] = group;
  }
  return result;
}
