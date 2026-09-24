import { validateChain } from "../../core/chain.js";

function clone(value) { return value && typeof value === "object" ? structuredClone(value) : value; }

function requireProxy(config, id) {
  const proxy = (config.outbounds || []).find((o) => o && o.tag === id);
  if (!proxy) throw new Error("Xray outbound not found: " + id);
  return clone(proxy);
}

function compileNode(node) {
  const source = clone(node) || {};
  const protocol = String(source.protocol || source.type || "").toLowerCase();
  const output = { protocol, tag: source.name || source.id, settings: clone(source.settings) || {} };
  if (!output.tag || !output.protocol) throw new Error("Xray node requires tag and protocol: " + (source.id || "unknown"));
  if (source.server || source.address || source.port || source.server_port) {
    output.settings = output.settings || {};
    if (protocol === "vless" || protocol === "vmess") {
      const user = source.uuid || source.id;
      const server = source.server || source.address;
      const port = Number(source.port || source.server_port);
      if (server && Number.isFinite(port)) output.settings.vnext = [{ address: server, port, users: [{ id: user }] }];
    }
  }
  if (source.streamSettings) output.streamSettings = clone(source.streamSettings);
  return output;
}

export function compileXrayConfig(config) {
  const output = { outbounds: (config.nodes || []).map(compileNode) };
  if (config.routing && Object.keys(config.routing).length) output.routing = clone(config.routing);
  if (config.dns && Object.keys(config.dns).length) output.dns = clone(config.dns);
  return output;
}

export function compileXrayChain(config, chain) {
  const validation = validateChain(chain.mode, chain.hops);
  if (!validation.ok) throw new Error(validation.error);
  const output = clone(config) || {};
  output.outbounds = Array.isArray(output.outbounds) ? output.outbounds.map(clone) : [];
  for (let i = 1; i < chain.hops.length; i++) {
    const current = chain.hops[i], dialer = chain.hops[i - 1], outbound = requireProxy(output, current.id);
    outbound.streamSettings = clone(outbound.streamSettings) || {};
    outbound.streamSettings.sockopt = clone(outbound.streamSettings.sockopt) || {};
    outbound.streamSettings.sockopt.dialerProxy = dialer.id;
    output.outbounds[output.outbounds.findIndex((o) => o && o.tag === current.id)] = outbound;
  }
  return output;
}
