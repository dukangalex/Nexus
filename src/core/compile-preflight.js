import { validateUnifiedCompatibility } from "./compatibility.js";
import { getKernelSchema } from "./schema-registry.js";
import { getKernelUpstream } from "./kernel-registry.js";
import { validateSecurityPolicy } from "./security.js";

function diagnostic(code, severity, message, details = {}) {
  return Object.freeze({ code, severity, message, ...details });
}

const BUILTIN_TARGETS = new Set(["DIRECT", "direct", "REJECT", "reject", "Nexus-Direct", "Nexus-Blackhole", "Nexus-DNS"]);

function listById(value) {
  if (Array.isArray(value)) return value.filter((item) => item && item.id);
  if (value && typeof value === "object") return Object.values(value).filter((item) => item && item.id);
  return [];
}

function collectTargets(config, key, fields) {
  const targets = new Set();
  for (const item of listById(config[key])) {
    for (const value of fields) if (typeof value === "string" && value.trim()) targets.add(value.trim());
  }
  return targets;
}

function validateRoutingTargets(config) {
  const errors = [];
  if (!config.routing || typeof config.routing !== "object") return errors;

  const nodes = collectTargets(config, "nodes", ["id", "name", "tag"]);
  const groups = collectTargets(config, "groups", ["id", "name", "tag"]);
  const chains = collectTargets(config, "chains", ["id", "name", "tag"]);
  const strategies = new Set();
  for (const strategy of Array.isArray(config.routing.strategies) ? config.routing.strategies : []) {
    if (!strategy || typeof strategy !== "object") continue;
    for (const value of [strategy.id, strategy.name, strategy.tag]) if (typeof value === "string" && value.trim()) strategies.add(value.trim());
  }
  const targets = new Set([...nodes, ...groups, ...chains, ...strategies, ...BUILTIN_TARGETS]);

  const check = (action, location) => {
    if (!action || typeof action !== "object" || !["route", "chain", "dns", "bypass"].includes(action.type)) return;
    if (typeof action.target !== "string" || !action.target.trim()) return;
    const target = action.target.trim();
    if (action.type === "chain" && !chains.has(target)) {
      errors.push(diagnostic("ROUTING_CHAIN_UNRESOLVED", "error", "routing references missing chain: " + target, { target, location }));
      return;
    }
    if (!targets.has(target)) {
      errors.push(diagnostic("ROUTING_TARGET_UNRESOLVED", "error", "routing references missing node or group: " + target, { target, location }));
    }
  };

  check(config.routing.defaultAction, "routing.defaultAction");
  if (Array.isArray(config.routing.rules)) config.routing.rules.forEach((rule, index) => {
    if (rule && rule.enabled !== false) check(rule.action, `routing.rules[${index}].action`);
  });
  return errors;
}

export function preflightUnifiedConfig(config, kernel = config && config.kernel) {
  if (!config || typeof config !== "object") {
    const d = diagnostic("CONFIG_INVALID", "error", "unified configuration is required");
    return { ok: false, kernel: kernel || null, errors: [d], warnings: [], diagnostics: [d] };
  }
  const errors = [];
  const warnings = [];
  try {
    const upstream = getKernelUpstream(kernel);
    const schema = getKernelSchema(kernel, upstream.stable);
    const compatibility = validateUnifiedCompatibility(config, kernel);
    const security = validateSecurityPolicy(config);
    for (const item of security.errors) errors.push(diagnostic(item.code, "error", item.message, { key: item.key, value: item.value }));
    errors.push(...validateRoutingTargets(config));
    for (const item of compatibility.unsupported) errors.push(diagnostic("PROTOCOL_UNSUPPORTED", "error", "node protocol is unsupported", { id: item.id, protocol: item.protocol, reason: item.reason }));
    for (const item of compatibility.unknown) errors.push(diagnostic("PROTOCOL_UNKNOWN", "error", "node protocol compatibility is not established", { id: item.id, protocol: item.protocol, reason: item.reason }));
    for (const item of compatibility.constraintErrors) errors.push(diagnostic(item.code || "COMBINATION_UNSUPPORTED", "error", item.message || "node combination is unsupported", { id: item.id || null }));
    for (const item of compatibility.featureErrors) errors.push(diagnostic("FEATURE_UNSUPPORTED", "error", "kernel feature combination is unsupported", { id: item.id || null, feature: item.feature, protocol: item.protocol, transport: item.transport, reason: item.reason }));
    for (const item of compatibility.featureUnknown) errors.push(diagnostic("FEATURE_UNKNOWN", "error", "kernel feature capability is not established", { id: item.id || null, feature: item.feature, protocol: item.protocol, transport: item.transport, reason: item.reason }));
    for (const item of compatibility.warnings) warnings.push(diagnostic(item.code || "COMPATIBILITY_WARNING", "warning", item.message || "compatibility warning", { id: item.id || null }));
    return { ok: errors.length === 0, kernel, version: upstream.stable, schemaId: schema.schemaId, compatibility, security, errors, warnings, diagnostics: errors.concat(warnings) };
  } catch (error) {
    const d = diagnostic("PREFLIGHT_FAILED", "error", error.message);
    return { ok: false, kernel: kernel || null, errors: [d], warnings, diagnostics: [d] };
  }
}
