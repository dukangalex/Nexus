import yaml from "js-yaml";
import { dedupeNodes, limitNodes } from "./config.js";

function decodeBase64(value) {
  const normalized = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function fingerprint(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseShareLink(link) {
  const url = new URL(link);
  const protocol = url.protocol.slice(0, -1).toLowerCase();
  const name = url.hash ? decodeURIComponent(url.hash.slice(1)) : protocol + "://" + url.hostname + ":" + (url.port || "");
  const node = {
    id: "share-" + fingerprint(link),
    name,
    kind: "node",
    protocol,
    server: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    source: "share-link",
    uri: link
  };

  if (url.username) node.username = decodeURIComponent(url.username);
  if (url.password) node.password = decodeURIComponent(url.password);

  for (const [key, value] of url.searchParams.entries()) {
    if (key !== "security" && key !== "type" && key !== "encryption") node[key] = value;
  }

  return node;
}

function extractNodes(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.proxies)) return parsed.proxies;
  if (parsed && Array.isArray(parsed.outbounds)) {
    return parsed.outbounds.filter((item) => item && item.type && !["selector", "urltest", "direct", "block", "dns"].includes(item.type));
  }
  if (parsed && Array.isArray(parsed.nodes)) return parsed.nodes;
  return [];
}

function parseStructured(text) {
  try {
    return JSON.parse(text);
  } catch {
    try {
      return yaml.load(text);
    } catch {
      return null;
    }
  }
}

export function parseSubscription(input, { maxNodes = 30 } = {}) {
  if (typeof input !== "string" || !input.trim()) {
    throw new TypeError("subscription input must be non-empty text");
  }

  const text = input.trim();
  let nodes;

  if (/^(vmess|vless|trojan|ss|hysteria2|hy2|tuic|anytls):\/\//i.test(text)) {
    nodes = text.split(/\r?\n|(?=(?:vmess|vless|trojan|ss|hysteria2|hy2|tuic|anytls):\/\/)/i)
      .map((line) => line.trim()).filter(Boolean).map(parseShareLink);
  } else {
    let parsed = parseStructured(text);
    if (parsed === null) parsed = parseStructured(decodeBase64(text));
    if (parsed === null) throw new Error("unsupported subscription format");
    nodes = extractNodes(parsed);
  }

  const normalized = nodes
    .filter((node) => node && typeof node === "object")
    .map((node, index) => ({
      ...node,
      id: String(node.id || node.name || node.tag || (node.protocol || node.type || "node") + "-" + (index + 1)),
      name: String(node.name || node.tag || node.id || "Node " + (index + 1)),
      kind: "node"
    }));

  return limitNodes(dedupeNodes(normalized), maxNodes);
}
