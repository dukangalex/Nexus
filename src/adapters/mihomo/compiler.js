import { validateChain } from "../../core/chain.js";

function clone(value) {
  return value && typeof value === "object" ? structuredClone(value) : value;
}

function requireProxy(config, id) {
  const proxy = (config.proxies || []).find((p) => p && p.name === id);
  if (!proxy) throw new Error("Mihomo proxy not found: " + id);
  return clone(proxy);
}

export function compileMihomoChain(config, chain) {
  const validation = validateChain(chain.mode, chain.hops);
  if (!validation.ok) throw new Error(validation.error);
  const output = clone(config) || {};
  output.proxies = Array.isArray(output.proxies) ? output.proxies.map(clone) : [];
  for (let i = 1; i < chain.hops.length; i++) {
    const current = chain.hops[i];
    const dialer = chain.hops[i - 1];
    const proxy = requireProxy(output, current.id);
    proxy["dialer-proxy"] = dialer.id;
    const index = output.proxies.findIndex((p) => p && p.name === current.id);
    output.proxies[index] = proxy;
  }
  return output;
}
