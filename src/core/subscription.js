import yaml from "js-yaml";
import { dedupeNodes, limitNodes } from "./config.js";

function decodeBase64(value) {
  const normalized = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function parseShareLink(link) {
  const url = new URL(link);
  const protocol = url.protocol.slice(0, -1).toLowerCase();
  const node = {
    id: link,
    name: url.hash ? decodeURIComponent(url.hash.slice(1)) : protocol + "://" + url.hostname + ":" + (url.port || ""),
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
  if (parsed && Array.isArray(parsed.outbounds)) return parsed.outbounds;
  if (parsed && Array.isArray(parsed.nodes)) return parsed.nodes;
  return [];
}

export function parseSubscription(input, { maxNodes = 30 } = {}) {
  if (typeof input !== "string" || !input.trim()) throw new TypeError("subscription input must be non-empty text");

  const text = input.trim();
  let nodes;

  if (/^(vmess|vless|trojan|ss|hysteria2|hy2|tuic|anytls):\/\//i.test(text)) {
    nodes = text.split(/\r?\n/).filter(Boolean).map(parseShareLink);
  } else {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      try { parsed = yaml.load(text); } catch { parsed = null; }
    }

    if (!parsed) {
      try {
        parsed = JSON.parse(decodeBase64(text));
      } catch {
        try { parsed = yaml.load(decodeBase64(text)); }
        catch { throw new Error("unsupported subscription format"); }
      }
    }

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
