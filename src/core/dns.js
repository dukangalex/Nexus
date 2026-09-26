import { Kernels } from "./model.js";

export const dnsPolicy = Object.freeze({
  encrypted: true,
  preferFakeIp: true,
  sniffSni: true,
  ipv6LeakProtection: true
});

export const defaultEncryptedDns = "https://1.1.1.1/dns-query";

function parseEncryptedDns(value) {
  if (typeof value !== "string") return null;
  const input = value.trim();
  if (!input) return null;
  let url;
  try { url = new URL(input); } catch { return null; }
  if (url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  return Object.freeze({
    url: input,
    host: url.hostname,
    port: Number(url.port || 443),
    path: url.pathname || "/dns-query"
  });
}

function dnsServers(config) {
  const dns = config && config.dns;
  if (!dns || typeof dns !== "object") return [defaultEncryptedDns];
  const raw = dns.servers || dns.nameservers || dns.nameserver;
  if (raw === undefined) return [defaultEncryptedDns];
  if (Array.isArray(raw) && raw.length === 0) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function buildDnsPolicy(overrides = {}) {
  return { ...dnsPolicy, ...overrides };
}

export function normalizeEncryptedDns(config = {}) {
  const source = config && typeof config === "object" && (config.servers !== undefined || config.nameservers !== undefined || config.nameserver !== undefined) && config.dns === undefined
    ? { dns: config }
    : config;
  const servers = dnsServers(source);
  if (servers.length === 0) {
    const error = new Error("Nexus requires at least one encrypted DNS over HTTPS server");
    error.code = "DNS_SERVERS_EMPTY";
    throw error;
  }
  const parsed = servers.map(parseEncryptedDns);
  const invalid = parsed.map((item, index) => item ? null : index).filter((index) => index !== null);
  if (invalid.length) {
    const values = invalid.map((index) => servers[index]);
    const error = new Error("Nexus requires kernel-portable encrypted DNS over HTTPS; invalid DNS server: " + values.join(", "));
    error.code = "DNS_ENCRYPTED_ENDPOINT_UNSUPPORTED";
    throw error;
  }
  return parsed;
}

export function compileDnsConfig(config = {}, kernel) {
  const servers = normalizeEncryptedDns(config);
  if (kernel === Kernels.MIHOMO) {
    return {
      enable: true,
      nameserver: servers.map((server) => server.url),
      "proxy-server-nameserver": servers.map((server) => server.url),
      "direct-nameserver": servers.map((server) => server.url)
    };
  }
  if (kernel === Kernels.SING_BOX) {
    const compiled = servers.map((server, index) => ({
      type: "https",
      tag: "Nexus-DNS-" + index,
      server: server.host,
      server_port: server.port,
      path: server.path,
      tls: { enabled: true }
    }));
    return { servers: compiled, final: compiled[0].tag };
  }
  if (kernel === Kernels.XRAY) {
    return {
      servers: servers.map((server) => server.url),
      queryStrategy: "UseIPv4"
    };
  }
  throw new Error("unsupported DNS kernel: " + kernel);
}
