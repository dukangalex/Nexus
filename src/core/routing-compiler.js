import { validateRoutingPolicy, RoutingMatchTypes } from "./routing-policy.js";

const KERNEL_MATCHES = Object.freeze({
  mihomo: new Set([
    "domain", "domain_suffix", "domain_keyword", "ip_cidr", "source_ip_cidr",
    "port", "source_port", "network", "geoip", "geosite", "rule_set",
    "process_name", "process_path", "package_name", "inbound", "logical"
  ]),
  "sing-box": new Set([
    "domain", "domain_suffix", "domain_keyword", "ip_cidr", "source_ip_cidr",
    "port", "source_port", "network", "protocol", "geoip", "geosite",
    "rule_set", "process_name", "process_path", "package_name", "inbound", "logical"
  ]),
  xray: new Set([
    "domain", "domain_suffix", "domain_keyword", "ip_cidr", "source_ip_cidr",
    "port", "source_port", "network", "protocol", "geoip", "geosite", "inbound",
    "process_name"
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
  return String(value).trim().replace(/^domain:/i, "");
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
  for (const value of list(match.network || [])) rules.push(["NETWORK", String(value).toLowerCase()]);
  for (const value of list(match.geoip || [])) rules.push(["GEOIP", String(value).toUpperCase()]);
  for (const value of list(match.geosite || [])) rules.push(["GEOSITE", String(value)]);
  for (const value of list(match.rule_set || [])) rules.push(["RULE-SET", String(value)]);
  for (const value of list(match.process_name || [])) rules.push(["PROCESS-NAME", String(value)]);
  for (const value of list(match.process_path || [])) rules.push(["PROCESS-PATH", String(value)]);
  for (const value of list(match.package_name || [])) rules.push(["PROCESS-NAME", String(value)]);
  for (const value of list(match.inbound || [])) rules.push(["IN-NAME", String(value)]);
  if (match.logical) throw new Error("Mihomo logical routing requires adapter-specific compilation");
  return rules;
}

function compileSingBoxMatch(match) {
  const output = {};
  const fields = [
    "domain", "domain_suffix", "domain_keyword", "ip_cidr", "source_ip_cidr",
    "port", "source_port", "network", "protocol", "geoip", "geosite",
    "rule_set", "process_name", "process_path", "package_name", "inbound"
  ];
  for (const field of fields) {
    if (match[field] !== undefined) output[field] = list(match[field]).map((value) => {
      if (field === "port" || field === "source_port") return Number(value);
      return String(value);
    });
  }
  if (match.logical !== undefined) output.logical = structuredClone(match.logical);
  return output;
}

function compileXrayMatch(match) {
  const output = {};
  if (match.domain !== undefined) output.domain = list(match.domain).map((value) => "full:" + normalizeDomain(value));
  if (match.domain_suffix !== undefined) output.domain = list(match.domain_suffix).map((value) => "domain:" + normalizeDomain(value));
  if (match.domain_keyword !== undefined) output.domain = list(match.domain_keyword).map((value) => "keyword:" + String(value));
  if (match.ip_cidr !== undefined) output.ip = list(match.ip_cidr).map(String);
  if (match.source_ip_cidr !== undefined) output.sourceIP = list(match.source_ip_cidr).map(String);
  if (match.port !== undefined) output.port = list(match.port).map(String).join(",");
  if (match.source_port !== undefined) output.sourcePort = list(match.source_port).map(String).join(",");
  if (match.network !== undefined) output.network = list(match.network).map(String).join(",");
  if (match.protocol !== undefined) output.protocol = list(match.protocol).map(String);
  if (match.geoip !== undefined) output.ip = list(match.geoip).map((value) => "geoip:" + String(value));
  if (match.geosite !== undefined) output.domain = list(match.geosite).map((value) => "geosite:" + String(value));
  if (match.inbound !== undefined) output.inboundTag = list(match.inbound).map(String);
  if (match.process_name !== undefined) output.process = list(match.process_name).map(String);
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
        ? { action: "route", outbound: "__nexus_direct" }
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
    return rules.flatMap((rule) => compileMihomoMatch(rule.match)
      .map((parts) => [...parts, compileAction(rule.action, kernel)]));
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
