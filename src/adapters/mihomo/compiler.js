import { validateChain } from "../../core/chain.js";

function clone(value) { return value && typeof value === "object" ? structuredClone(value) : value; }

function requireProxy(config, id) {
  const proxy = (config.proxies || []).find((p) => p && p.name === id);
  if (!proxy) throw new Error("Mihomo proxy not found: " + id);
  return clone(proxy);
}

function compileNode(node) {
  const source = clone(node) || {};
  const type = String(source.protocol || source.type || "").toLowerCase();
  const output = {
    name: source.name || source.id,
    type,
    server: source.endpoint?.server || source.server || source.address,
    port: Number(source.endpoint?.port || source.port || source.server_port)
  };
  if (source.auth?.uuid && ["vless", "vmess"].includes(type)) output.uuid = source.auth.uuid;
  if (source.auth?.username) output.username = source.auth.username;
  if (source.auth?.password) output.password = source.auth.password;
  if (source.tls) {
    output.tls = Boolean(source.tls.enabled);
    if (source.tls.serverName) output.sni = source.tls.serverName;
    if (source.tls.insecure) output["skip-cert-verify"] = true;
    if (source.tls.alpn?.length) output.alpn = [...source.tls.alpn];
    if (source.tls.fingerprint) output["client-fingerprint"] = source.tls.fingerprint;
  }
  if (source.transport?.type === "ws") {
    output.network = "ws";
    output["ws-opts"] = { path: source.transport.path || "/" };
    if (source.transport.headers) output["ws-opts"].headers = clone(source.transport.headers);
  } else if (source.transport?.type === "grpc") {
    output.network = "grpc";
    output["grpc-opts"] = { "grpc-service-name": source.transport.serviceName || "" };
  }
  if (!output.name || !output.type || !output.server || !Number.isFinite(output.port)) {
    throw new Error("Mihomo node requires name, type, server and port: " + (source.id || "unknown"));
  }
  if (source.udp !== undefined) output.udp = Boolean(source.udp);
  if (source.flow !== undefined) output.flow = clone(source.flow);
  if (source.auth?.flow !== undefined) output.flow = clone(source.auth.flow);
  if (source.auth?.alterId !== undefined) output.alterId = clone(source.auth.alterId);
  if (source.method !== undefined) output.cipher = clone(source.method);
  if (source.cipher !== undefined) output.cipher = clone(source.cipher);
  return output;
}

export function compileMihomoConfig(config) {
  const output = { proxies: (config.nodes || []).map(compileNode) };
  if (Array.isArray(config.groups) && config.groups.length) output["proxy-groups"] = clone(config.groups);
  if (config.dns && Object.keys(config.dns).length) output.dns = clone(config.dns);
  if (config.routing && Object.keys(config.routing).length) output.rules = clone(config.routing.rules || []);
  return output;
}

export function compileMihomoChain(config, chain) {
  const validation = validateChain(chain.mode, chain.hops);
  if (!validation.ok) throw new Error(validation.error);
  const output = clone(config) || {};
  output.proxies = Array.isArray(output.proxies) ? output.proxies.map(clone) : [];
  for (let i = 1; i < chain.hops.length; i++) {
    const current = chain.hops[i], dialer = chain.hops[i - 1], proxy = requireProxy(output, current.id);
    proxy["dialer-proxy"] = dialer.id;
    output.proxies[output.proxies.findIndex((p) => p && p.name === current.id)] = proxy;
  }
  return output;
}
