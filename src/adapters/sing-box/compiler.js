import { validateChain } from "../../core/chain.js";

function clone(value) { return value && typeof value === "object" ? structuredClone(value) : value; }

function requireOutbound(config, id) {
  const outbound = (config.outbounds || []).find((o) => o && o.tag === id);
  if (!outbound) throw new Error("sing-box outbound not found: " + id);
  return clone(outbound);
}

function compileNode(node) {
  const source = clone(node) || {};
  const type = String(source.protocol || source.type || "").toLowerCase();
  const output = { type, tag: source.name || source.id, server: source.server || source.address, server_port: Number(source.server_port || source.port) };
  if (!output.tag || !output.type || !output.server || !Number.isFinite(output.server_port)) throw new Error("sing-box node requires tag, type, server and server_port: " + (source.id || "unknown"));
  for (const key of ["uuid", "password", "username", "tls", "transport", "network", "security", "alter_id", "flow", "packet_encoding", "multiplex"]) if (source[key] !== undefined) output[key] = clone(source[key]);
  return output;
}

export function compileSingBoxConfig(config) {
  const output = { outbounds: (config.nodes || []).map(compileNode) };
  if (Array.isArray(config.groups) && config.groups.length) output.outbounds.push(...clone(config.groups));
  if (config.dns && Object.keys(config.dns).length) output.dns = clone(config.dns);
  if (config.routing && Object.keys(config.routing).length) output.route = clone(config.routing);
  return output;
}

export function compileSingBoxChain(config, chain) {
  const validation = validateChain(chain.mode, chain.hops);
  if (!validation.ok) throw new Error(validation.error);
  const output = clone(config) || {};
  output.outbounds = Array.isArray(output.outbounds) ? output.outbounds.map(clone) : [];
  for (let i = 1; i < chain.hops.length; i++) {
    const current = chain.hops[i], detour = chain.hops[i - 1], outbound = requireOutbound(output, current.id);
    outbound.detour = detour.id;
    output.outbounds[output.outbounds.findIndex((o) => o && o.tag === current.id)] = outbound;
  }
  return output;
}
