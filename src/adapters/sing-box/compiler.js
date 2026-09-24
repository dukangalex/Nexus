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
  const output = { type, tag: source.name || source.id, server: source.endpoint?.server || source.server || source.address, server_port: Number(source.endpoint?.port || source.server_port || source.port) };
  if (source.auth?.uuid && (type === "vless" || type === "vmess")) {
    output.uuid = source.auth.uuid;
  } else if (source.auth?.username && type === "http") {
    output.username = source.auth.username;
    if (source.auth.password) output.password = source.auth.password;
  } else if (source.auth?.password && ["trojan", "shadowsocks", "hysteria2", "tuic", "anytls"].includes(type)) {
    output.password = source.auth.password;
  }
  if (source.tls) {
    output.tls = { enabled: Boolean(source.tls.enabled), server_name: source.tls.serverName || undefined };
    if (source.tls.alpn?.length) output.tls.alpn = [...source.tls.alpn];
    if (source.tls.insecure) output.tls.insecure = true;
    if (source.tls.fingerprint) output.tls.utls = { enabled: true, fingerprint: source.tls.fingerprint };
  }
  if (source.transport?.type === "ws") {
    output.transport = { type: "ws", path: source.transport.path || "/" };
    if (source.transport.headers) output.transport.headers = clone(source.transport.headers);
  } else if (source.transport?.type === "grpc") {
    output.transport = { type: "grpc", service_name: source.transport.serviceName || "" };
  }
  if (!output.tag || !output.type || !output.server || !Number.isFinite(output.server_port)) throw new Error("sing-box node requires tag, type, server and server_port: " + (source.id || "unknown"));
  for (const key of ["uuid", "password", "username", "network", "security", "alter_id", "flow", "packet_encoding", "multiplex"]) if (source[key] !== undefined && output[key] === undefined) output[key] = clone(source[key]);
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
