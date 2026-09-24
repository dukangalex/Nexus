import { validateChain } from "../../core/chain.js";

function clone(value) {
  return value && typeof value === "object" ? structuredClone(value) : value;
}

function requireProxy(config, id) {
  const proxy = (config.outbounds || []).find((o) => o && o.tag === id);
  if (!proxy) throw new Error("Xray outbound not found: " + id);
  return clone(proxy);
}

export function compileXrayChain(config, chain) {
  const validation = validateChain(chain.mode, chain.hops);
  if (!validation.ok) throw new Error(validation.error);
  const output = clone(config) || {};
  output.outbounds = Array.isArray(output.outbounds) ? output.outbounds.map(clone) : [];
  for (let i = 1; i < chain.hops.length; i++) {
    const current = chain.hops[i];
    const dialer = chain.hops[i - 1];
    const outbound = requireProxy(output, current.id);
    outbound.streamSettings = clone(outbound.streamSettings) || {};
    outbound.streamSettings.sockopt = clone(outbound.streamSettings.sockopt) || {};
    outbound.streamSettings.sockopt.dialerProxy = dialer.id;
    const index = output.outbounds.findIndex((o) => o && o.tag === current.id);
    output.outbounds[index] = outbound;
  }
  return output;
}
