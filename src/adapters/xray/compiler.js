import { validateChain } from "../../core/chain.js";
import { Kernels } from "../../core/model.js";
import { compileRoutingPolicy } from "../../core/routing-compiler.js";

function clone(value) { return value && typeof value === "object" ? structuredClone(value) : value; }
function requireProxy(config, id) {
  const proxy = (config.outbounds || []).find((o) => o && o.tag === id);
  if (!proxy) throw new Error("Xray outbound not found: " + id);
  return clone(proxy);
}
function compileNode(node) {
  const source = clone(node) || {};
  const protocol = String(source.protocol || source.type || "").toLowerCase();
  const endpoint = source.endpoint || {};
  const server = endpoint.server || source.server || source.address;
  const port = Number(endpoint.port || source.port || source.server_port);
  const tag = source.name || source.id;
  if (!tag || !protocol || !server || !Number.isFinite(port)) throw new Error("Xray node requires tag, protocol, server and port: " + (source.id || "unknown"));
  const auth = source.auth || source;
  const settings = clone(source.settings) || {};
  const output = { protocol, tag, settings };
  if (protocol === "vless") {
    settings.address = server; settings.port = port; settings.id = auth.uuid || source.uuid; settings.encryption = source.encryption || "none";
    if (auth.flow || source.flow) settings.flow = auth.flow || source.flow;
  } else if (protocol === "vmess") {
    settings.address = server; settings.port = port; settings.id = auth.uuid || source.uuid; settings.security = source.security || "auto"; settings.alterId = auth.alterId ?? source.alterId ?? 0;
  } else if (protocol === "trojan") {
    settings.address = server; settings.port = port; settings.password = auth.password || source.password;
  } else if (protocol === "hysteria") {
    settings.version = source.version === undefined ? 2 : Number(source.version);
    settings.address = server; settings.port = port;
    if (auth.password || source.password) {
      output.streamSettings = { method: "hysteria", hysteriaSettings: { version: settings.version, auth: auth.password || source.password } };
    }
  } else if (protocol === "shadowsocks") {
    settings.address = server; settings.port = port; settings.method = source.method || source.cipher; settings.password = auth.password || source.password;
  } else if (protocol === "socks" || protocol === "http") {
    settings.address = server; settings.port = port;
    if (auth.username) settings.user = auth.username;
    if (auth.password) settings.pass = auth.password;
  } else if (protocol === "wireguard") {
    settings.secretKey = source.private_key || source.privateKey;
    settings.address = Array.isArray(source.addresses) ? clone(source.addresses) : (Array.isArray(source.address) ? clone(source.address) : []);
    settings.peers = Array.isArray(source.peers) ? clone(source.peers) : [];
    for (const peer of settings.peers) if (peer && !peer.endpoint) peer.endpoint = server + ":" + port;
  }
  if (protocol === "vless" && !settings.id) throw new Error("Xray VLESS requires UUID: " + tag);
  if (protocol === "vmess" && !settings.id) throw new Error("Xray VMess requires UUID: " + tag);
  if (["trojan","shadowsocks"].includes(protocol) && !settings.password) throw new Error("Xray " + protocol + " requires password: " + tag);
  if (protocol === "shadowsocks" && !settings.method) throw new Error("Xray Shadowsocks requires method: " + tag);
  if (protocol === "hysteria" && settings.version !== 2) throw new Error("Xray Hysteria outbound requires version 2: " + tag);
  if (source.tls) {
    output.streamSettings = output.streamSettings || {};
    output.streamSettings.security = source.tls.reality?.enabled ? "reality" : (source.tls.enabled ? "tls" : "none");
    if (source.tls.serverName) {
      output.streamSettings.tlsSettings = output.streamSettings.tlsSettings || {};
      output.streamSettings.tlsSettings.serverName = source.tls.serverName;
    }
    if (source.tls.alpn?.length) {
      output.streamSettings.tlsSettings = output.streamSettings.tlsSettings || {};
      output.streamSettings.tlsSettings.alpn = [...source.tls.alpn];
    }
    if (source.tls.fingerprint && !source.tls.reality?.enabled) {
      output.streamSettings.tlsSettings = output.streamSettings.tlsSettings || {};
      output.streamSettings.tlsSettings.fingerprint = source.tls.fingerprint;
    }
    if (source.tls.reality?.enabled) {
      output.streamSettings.realitySettings = {
        serverName: source.tls.serverName || "",
        fingerprint: source.tls.fingerprint,
        password: source.tls.reality.publicKey,
        shortId: source.tls.reality.shortId,
        spiderX: source.tls.reality.spiderX
      };
    }
  }
  if (source.transport?.type) {
    output.streamSettings = output.streamSettings || {};
    output.streamSettings.network = source.transport.type;
    if (source.transport.type === "ws") {
      output.streamSettings.wsSettings = { path: source.transport.path || "/" };
      if (source.transport.headers) output.streamSettings.wsSettings.headers = clone(source.transport.headers);
    } else if (source.transport.type === "grpc") {
      output.streamSettings.grpcSettings = { serviceName: source.transport.serviceName || "" };
    } else if (source.transport.type === "xhttp") output.streamSettings.xhttpSettings = clone(source.transport.raw || {});
  }
  if (source.streamSettings) output.streamSettings = { ...(output.streamSettings || {}), ...clone(source.streamSettings) };
  return output;
}
export function compileXrayConfig(config) {
  const output = { outbounds: (config.nodes || []).map(compileNode) };
  if (config.routing && Object.keys(config.routing).length) {
    output.routing = { rules: compileRoutingPolicy(config.routing, Kernels.XRAY) };
    const fallback = config.routing.defaultAction;
    if (fallback && (fallback.type === "route" || fallback.type === "chain")) {
      output.routing.rules.push({ network: "tcp,udp", outboundTag: fallback.target, ruleTag: "Nexus-default" });
    } else if (fallback && fallback.type === "reject") {
      output.routing.rules.push({ network: "tcp,udp", outboundTag: "Nexus-Blackhole", ruleTag: "Nexus-default" });
    } else if (fallback && fallback.type !== "dns" && fallback.type !== "bypass") {
      throw new Error("unsupported Xray default routing action: " + fallback.type);
    }
    const actions = (config.routing.rules || []).filter((rule) => rule && rule.enabled).map((rule) => rule.action && rule.action.type);
    if (actions.includes("reject")) output.outbounds.push({ protocol: "blackhole", tag: "Nexus-Blackhole" });
    if (actions.includes("bypass")) output.outbounds.push({ protocol: "freedom", tag: "Nexus-Direct" });
    if (actions.includes("dns")) output.outbounds.push({ protocol: "dns", tag: "Nexus-DNS" });
  }
  if (config.dns && Object.keys(config.dns).length) output.dns = clone(config.dns);
  return output;
}
export function compileXrayChain(config, chain) {
  const validation = validateChain(chain.mode, chain.hops);
  if (!validation.ok) throw new Error(validation.error);
  const output = clone(config) || {};
  output.outbounds = Array.isArray(output.outbounds) ? output.outbounds.map(clone) : [];
  for (let i = 1; i < chain.hops.length; i++) {
    const current = chain.hops[i], dialer = chain.hops[i - 1];
    const outbound = requireProxy(output, current.name || current.id);
    outbound.streamSettings = clone(outbound.streamSettings) || {};
    outbound.streamSettings.sockopt = clone(outbound.streamSettings.sockopt) || {};
    outbound.streamSettings.sockopt.dialerProxy = dialer.name || dialer.id;
    const index = output.outbounds.findIndex((o) => o && o.tag === (current.name || current.id));
    if (index < 0) throw new Error("Xray outbound not found: " + (current.name || current.id));
    output.outbounds[index] = outbound;
  }
  return output;
}
