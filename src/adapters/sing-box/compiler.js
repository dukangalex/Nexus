import { validateChain } from "../../core/chain.js";

function clone(value) {
  return value && typeof value === "object" ? structuredClone(value) : value;
}

function requireOutbound(config, id) {
  const outbound = (config.outbounds || []).find((o) => o && o.tag === id);
  if (!outbound) throw new Error("sing-box outbound not found: " + id);
  return clone(outbound);
}

export function compileSingBoxChain(config, chain) {
  const validation = validateChain(chain.mode, chain.hops);
  if (!validation.ok) throw new Error(validation.error);
  const output = clone(config) || {};
  output.outbounds = Array.isArray(output.outbounds) ? output.outbounds.map(clone) : [];
  for (let i = 1; i < chain.hops.length; i++) {
    const current = chain.hops[i];
    const detour = chain.hops[i - 1];
    const outbound = requireOutbound(output, current.id);
    outbound.detour = detour.id;
    const index = output.outbounds.findIndex((o) => o && o.tag === current.id);
    output.outbounds[index] = outbound;
  }
  return output;
}
