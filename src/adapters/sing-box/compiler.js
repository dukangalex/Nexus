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
  const auth = source.auth || source;
  if (auth.uuid && ["vless","vmess","tuic"].includes(type)) output.uuid = auth.uuid;
  if (auth.username && type === "http") output.username = auth.username;
  if (auth.password && ["http","trojan","shadowsocks","hysteria","hysteria2","tuic","anytls"].includes(type)) output.password = auth.password;
  if (source.tls) {
    output.tls = { enabled: Boolean(source.tls.enabled || source.tls.reality?.enabled) };
    if (source.tls.serverName) output.tls.server_name = source.tls.serverName;
    if (source.tls.minVersion) output.tls.min_version = source.tls.minVersion;
    if (source.tls.maxVersion) output.tls.max_version = source.tls.maxVersion;
    if (source.tls.alpn?.length) output.tls.alpn = [...source.tls.alpn];
    if (source.tls.insecure) output.tls.insecure = true;
    if (source.tls.fingerprint) output.tls.utls = { enabled: true, fingerprint: source.tls.fingerprint };
    if (source.tls.ech) output.tls.ech = clone(source.tls.ech);
    if (source.tls.reality?.enabled) {
      output.tls.reality = {
        enabled: true,
        public_key: source.tls.reality.publicKey,
        short_id: source.tls.reality.shortId
      };
    }
  }
  if (source.transport?.type) {
    output.transport = ["ws","http","h2","grpc","xhttp"].includes(source.transport.type) ? { type: source.transport.type } : clone(source.transport.raw || { type: source.transport.type });
    if (source.transport.path) output.transport.path = source.transport.path;
    if (source.transport.serviceName && source.transport.type === "grpc") output.transport.service_name = source.transport.serviceName;
    if (source.transport.headers) output.transport.headers = clone(source.transport.headers);
  }
  if (!output.tag || !output.type || !output.server || !Number.isFinite(output.server_port)) throw new Error("sing-box node requires tag, type, server and server_port: " + (source.id || "unknown"));
  if (auth.flow !== undefined) output.flow = clone(auth.flow);
  if (auth.alterId !== undefined && auth.alterId !== null) output.alter_id = clone(auth.alterId);
  if (source.udp !== undefined && source.udp !== null) output.network = source.udp ? "udp" : output.network;
  for (const key of ["security","packet_encoding","multiplex","congestion_control","udp_relay_mode","udp_over_stream","zero_rtt_handshake","heartbeat","up_mbps","down_mbps","hop_interval","hop_interval_max","bbr_profile","brutal_debug","disable_chrome_parrot","server_ports","obfs","realm","private_key","privateKey","peers","local_address","mtu"]) if (source[key] !== undefined) output[key] = clone(source[key]);
  if (source.privateKey !== undefined && output.private_key === undefined) output.private_key = clone(source.privateKey);
  if (source.encryption !== undefined) output.encryption = clone(source.encryption);
  if (source.method !== undefined && type === "shadowsocks") output.method = clone(source.method);
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
