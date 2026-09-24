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
    server: source.server || source.address,
    port: Number(source.port || source.server_port)
  };
  if (!output.name || !output.type || !output.server || !Number.isFinite(output.port)) {
    throw new Error("Mihomo node requires name, type, server and port: " + (source.id || "unknown"));
  }
  for (const key of ["udp", "tls", "sni", "servername", "network", "ws-opts", "grpc-opts", "reality-opts", "client-fingerprint", "uuid", "password", "username"]) {
    if (source[key] !== undefined) output[key] = clone(source[key]);
  }
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
