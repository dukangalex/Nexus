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
  const endpoint = source.endpoint || {};
  const server = endpoint.server || source.server || source.address;
  const port = Number(endpoint.port || source.port || source.server_port);
  const tag = source.name || source.id;
  if (!tag || !protocol || !server || !Number.isFinite(port)) {
    throw new Error("Xray node requires tag, protocol, server and port: " + (source.id || "unknown"));
  }

  const auth = source.auth || {};
  const settings = clone(source.settings) || {};
  const output = { protocol, tag, settings };

  if (protocol === "vless") {
    settings.vnext = undefined;
    settings.address = server;
    settings.port = port;
    settings.id = auth.uuid || source.uuid;
    settings.encryption = source.encryption || "none";
    if (auth.flow) settings.flow = auth.flow;
  } else if (protocol === "vmess") {
    settings.vnext = [{
      address: server,
      port,
      users: [{
        id: auth.uuid || source.uuid,
        alterId: auth.alterId ?? 0,
        security: source.security || "auto"
      }]
    }];
  } else if (protocol === "trojan") {
    settings.servers = [{
      address: server,
      port,
      password: auth.password || source.password
    }];
  } else if (protocol === "shadowsocks") {
    settings.servers = [{
      address: server,
      port,
      method: source.method || source.cipher,
      password: auth.password || source.password
    }];
  } else if (protocol === "socks") {
    settings.servers = [{ address: server, port, users: auth.username ? [{ user: auth.username, pass: auth.password || "" }] : [] }];
  } else if (protocol === "http") {
    settings.servers = [{ address: server, port, users: auth.username ? [{ user: auth.username, pass: auth.password || "" }] : [] }];
  } else if (protocol === "wireguard") {
    settings.secretKey = source.private_key || source.privateKey;
    settings.address = server;
    settings.port = port;
  }

  if (protocol === "vless" && !settings.id) throw new Error("Xray VLESS requires UUID: " + tag);
  if (protocol === "vmess" && !settings.vnext[0].users[0].id) throw new Error("Xray VMess requires UUID: " + tag);
  if (["trojan", "shadowsocks"].includes(protocol) && !settings.servers[0].password) {
    throw new Error("Xray " + protocol + " requires password: " + tag);
  }
  if (protocol === "shadowsocks" && !settings.servers[0].method) {
    throw new Error("Xray Shadowsocks requires method: " + tag);
  }

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
    if (source.tls.fingerprint) {
      output.streamSettings.tlsSettings = output.streamSettings.tlsSettings || {};
      output.streamSettings.tlsSettings.fingerprint = source.tls.fingerprint;
    }
    if (source.tls.reality?.enabled) {
      output.streamSettings.realitySettings = {
        publicKey: source.tls.reality.publicKey,
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
    }
  }
  if (source.streamSettings) {
    output.streamSettings = { ...(output.streamSettings || {}), ...clone(source.streamSettings) };
  }
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
