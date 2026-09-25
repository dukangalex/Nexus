import { validateRoutingPolicy, RoutingMatchTypes } from "./routing-policy.js";

const COMMON_MATCHES = new Set([
  "domain",
  "domain_suffix",
  "domain_keyword",
  "ip_cidr",
  "source_ip_cidr",
  "port",
  "source_port",
  "network",
  "protocol",
  "geoip",
  "geosite",
  "rule_set",
  "inbound",
  "interface"
]);

const KERNEL_MATCHES = Object.freeze({
  mihomo: new Set([...COMMON_MATCHES, "process_name", "process_path", "package_name", "logical"]),
  "sing-box": new Set([...COMMON_MATCHES, "process_name", "process_path", "package_name", "logical"]),
  xray: new Set([
    "domain", "ip_cidr", "source_ip_cidr", "port", "source_port",
    "network", "protocol", "geoip", "geosite", "inbound"
  ])
});

const KERNEL_ACTIONS = Object.freeze({
  mihomo: new Set(["route", "reject", "bypass", "chain"]),
  "sing-box": new Set(["route", "reject", "bypass", "chain"]),
  xray: new Set(["route", "reject", "bypass", "chain"])
});

function list(value) {
  return Array.isArray(value) ? value : [value];
}

function normalizeDomain(value) {
  const text = String(value).trim();
  return text.replace(/^domain:/i, "");
}

function compileMihomoMatch(match) {
  const rules = [];
  for (const value of list(match.domain || [])) rules.push(["DOMAIN", normalizeDomain(value)]);
  for (const value of list(match.domain_suffix || [])) rules.push(["DOMAIN-SUFFIX", normalizeDomain(value)]);
  for (const value of list(match.domain_keyword || [])) rules.push(["DOMAIN-KEYWORD", String(value)]);
  for (const value of list(match.ip_cidr || [])) rules.push(["IP-CIDR", String(value)]);
  for (const value of list(match.source_ip_cidr || [])) rules.push(["SRC-IP-CIDR", String(value)]);
  for (const value of list(match.port || [])) rules.push(["DST-PORT", String(value)]);
  for (const value of list(match.source_port || [])) rules.push(["SRC-PORT", String(value)]);
  for (const value of list(match.network || [])) rules.push(["NETWORK", String(value).toUpperCase()]);
  for (const value of list(match.protocol || [])) rules.push(["RULE-SET", String(value)]);
  for (const value of list(match.geoip || [])) rules.push(["GEOIP", String(value).toUpperCase()]);
  for (const value of list(match.geosite || [])) rules.push(["GEOSITE", String(value).toUpperCase()]);
  for (const value of list(match.rule_set || [])) rules.push(["RULE-SET", String(value)]);
  for (const value of list(match.process_name || [])) rules.push(["PROCESS-NAME", String(value)]);
  for (const value of list(match.process_path || [])) rules.push(["PROCESS-PATH", String(value)]);
  for (const value of list(match.package_name || [])) rules.push(["PROCESS-NAME", String(value)]);
  for (const value of list(match.inbound || [])) rules.push(["IN-TYPE", String(value)]);
  for (const value of list(match.interface || [])) rules.push(["IN-TYPE", String(value)]);
  if (match.logical) throw new Error("Mihomo logical routing requires adapter-specific logical compilation");
  return rules;
}

function compileSingBoxMatch(match) {
  const output = {};
  const map = {
    domain: "domain",
    domain_suffix: "domain_suffix",
    domain_keyword: "domain_keyword",
    ip_cidr: "ip_cidr",
    source_ip_cidr: "source_ip_cidr",
    port: "port",
    source_port: "source_port",
    network: "network",
    protocol: "protocol",
    geoip: "ip_is_private",
    geosite: "domain_suffix",
    rule_set: "rule_set",
    process_name: "process_name",
    process_path: "process_path",
    package_name: "package_name",
    inbound: "inbound",
    interface: "inbound_interface"
  };
  for (const [source, target] of Object.entries(map)) {
    if (match[source] !== undefined) output[target] = list(match[source]).map(String);
  }
  if (match.geoip !== undefined) {
    output.ip_cidr = list(match.geoip).map((value) => String(value));
    delete output.ip_is_private;
  }
  if (match.geosite !== undefined) output.domain_suffix = list(match.geosite).map((value) => String(value));
  if (match.logical !== undefined) output.logical = structuredClone(match.logical);
  return output;
}

function compileXrayMatch(match) {
  const output = {};
  const map = {
    domain: "domain",
    domain_suffix: "domain",
    domain_keyword: "domain",
    ip_cidr: "ip",
    source_ip_cidr: "source",
    port: "port",
    source_port: "sourcePort",
    network: "network",
    protocol: "protocol",
    geoip: "ip",
    geosite: "domain",
    inbound: "inboundTag"
  };
  for (const [source, target] of Object.entries(map)) {
    if (match[source] !== undefined) {
      const values = list(match[source]).map(String);
      if (["domain", "ip", "source", "protocol", "inboundTag"].includes(target)) {
        output[target] = values;
      } else {
        output[target] = values.length === 1 ? values[0] : values.join(",");
      }
    }
  }
  if (match.domain_suffix !== undefined) {
    output.domain = list(match.domain_suffix).map((value) => "domain:" + normalizeDomain(value));
  }
  if (match.domain_keyword !== undefined) {
    output.domain = list(match.domain_keyword).map((value) => "keyword:" + String(value));
  }
  if (match.geoip !== undefined) {
    output.ip = list(match.geoip).map((value) => "geoip:" + String(value));
  }
  if (match.geosite !== undefined) {
    output.domain = list(match.geosite).map((value) => "geosite:" + String(value));
  }
  return output;
}

function compileAction(action, kernel) {
  if (action.type === "route" || action.type === "chain") {
    return kernel === "xray"
      ? { outboundTag: action.target }
      : kernel === "sing-box"
        ? { action: "route", outbound: action.target }
        : action.target;
  }
  if (action.type === "reject") {
    return kernel === "xray"
      ? { outboundTag: "__nexus_block" }
      : kernel === "sing-box"
        ? { action: "reject" }
        : "REJECT";
  }
  if (action.type === "bypass") {
    return kernel === "xray"
      ? { outboundTag: "__nexus_direct" }
      : kernel === "sing-box"
        ? { action: "route", outbound: "direct" }
        : "DIRECT";
  }
  throw new Error("unsupported routing action for " + kernel + ": " + action.type);
}

function validateKernelFeatures(policy, kernel) {
  const errors = [];
  const supportedMatches = KERNEL_MATCHES[kernel];
  const supportedActions = KERNEL_ACTIONS[kernel];
  for (const rule of policy.rules || []) {
    if (!rule.enabled) continue;
    for (const type of RoutingMatchTypes) {
      if (rule.match[type] !== undefined && !supportedMatches.has(type)) {
        errors.push(kernel + " does not support routing match: " + type);
      }
    }
    if (!supportedActions.has(rule.action.type)) {
      errors.push(kernel + " does not support routing action: " + rule.action.type);
    }
  }
  return errors;
}

export function validateRoutingForKernel(policy, kernel) {
  const base = validateRoutingPolicy(policy);
  if (!base.ok) return base;
  if (!KERNEL_MATCHES[kernel]) return { ok: false, errors: ["unsupported kernel: " + kernel] };
  const errors = validateKernelFeatures(policy, kernel);
  return { ok: errors.length === 0, errors };
}

export function compileRoutingPolicy(policy, kernel) {
  const validation = validateRoutingForKernel(policy, kernel);
  if (!validation.ok) {
    throw new Error("routing policy is not compilable for " + kernel + ": " + validation.errors.join("; "));
  }

  const rules = (policy.rules || []).filter((rule) => rule.enabled);
  if (kernel === "mihomo") {
    return rules.flatMap((rule) => {
      const matches = compileMihomoMatch(rule.match);
      return matches.map((parts) => [...parts, compileAction(rule.action, kernel)]);
    });
  }

  if (kernel === "sing-box") {
    return rules.map((rule) => ({
      ...compileSingBoxMatch(rule.match),
      ...compileAction(rule.action, kernel)
    }));
  }

  return rules.map((rule) => ({
    type: "field",
    ...compileXrayMatch(rule.match),
    ...compileAction(rule.action, kernel)
  }));
}
