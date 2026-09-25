import { createRoutingPolicy, validateRoutingPolicy } from "./routing-policy.js";
import { resolveGroupMember } from "./group.js";

function values(value) { return Array.isArray(value) ? value : [value]; }
function normalize(value) { return String(value ?? "").toLowerCase(); }
function includesMatch(expected, actual) {
  if (expected === undefined) return true;
  const actualValues = values(actual).map(normalize);
  const expectedValues = values(expected).map(normalize);
  const positive = expectedValues.filter((item) => !item.startsWith("!"));
  const negative = expectedValues.filter((item) => item.startsWith("!")).map((item) => item.slice(1));
  if (negative.some((item) => actualValues.includes(item))) return false;
  if (!positive.length) return true;
  return positive.some((item) => actualValues.includes(item));
}
function domainSuffix(actual, expected) {
  const domain = normalize(actual).replace(/^\.+/, "");
  return values(expected).some((item) => { const suffix = normalize(item).replace(/^\.+/, ""); return domain === suffix || domain.endsWith("." + suffix); });
}
function domainKeyword(actual, expected) { const domain = normalize(actual); return values(expected).some((item) => domain.includes(normalize(item))); }
function cidrContains(actual, expected) { return includesMatch(expected, actual); }
function matchLogical(logical, facts) {
  if (!logical || typeof logical !== "object") return false;
  const mode = normalize(logical.mode || "and");
  const results = Array.isArray(logical.rules) ? logical.rules.map((rule) => matchObject(rule, facts)) : [];
  if (mode === "or") return results.some(Boolean);
  if (mode === "not") return results.length === 1 && !results[0];
  return results.length > 0 && results.every(Boolean);
}
function matchObject(match, facts) {
  if (!match || typeof match !== "object") return false;
  for (const [key, expected] of Object.entries(match)) {
    if (key === "logical") { if (!matchLogical(expected, facts)) return false; continue; }
    if (key === "domain_suffix") { if (!domainSuffix(facts.domain, expected)) return false; }
    else if (key === "domain_keyword") { if (!domainKeyword(facts.domain, expected)) return false; }
    else { const actual = facts[key]; if (key === "ip_cidr" || key === "source_ip_cidr") { if (!cidrContains(actual, expected)) return false; } else if (!includesMatch(expected, actual)) return false; }
  }
  return true;
}
export function matchesRoutingRule(rule, facts = {}) { return Boolean(rule?.enabled) && matchObject(rule.match, facts); }
export function resolveRoutingPolicy(policyInput, facts = {}, options = {}) {
  const policy = createRoutingPolicy(policyInput || {});
  const validation = validateRoutingPolicy(policy);
  if (!validation.ok) return { ok: false, action: { type: "reject" }, rule: null, error: validation.errors.join("; ") };
  if (policy.mode === "global_bypass") return { ok: true, action: { type: "bypass", target: options.bypassTarget || "direct" }, rule: null };
  if (policy.mode === "global_proxy") {
    const target = options.proxyTarget || policy.defaultAction.target;
    if (!target) return { ok: false, action: { type: "reject" }, rule: null, error: "global proxy target is required" };
    return { ok: true, action: { type: "route", target }, rule: null };
  }
  const ordered = [...policy.rules].filter((rule) => rule.enabled).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  for (const rule of ordered) if (matchesRoutingRule(rule, facts)) return { ok: true, action: structuredClone(rule.action), rule };
  if (options.failClosed === true) return { ok: true, action: { type: "reject" }, rule: null, reason: "no rule matched; fail-closed" };
  return { ok: true, action: structuredClone(policy.defaultAction), rule: null, reason: "default action" };
}
function groupForTarget(groups, target) {
  if (!groups || typeof groups !== "object") return null;
  if (groups instanceof Map) return groups.get(target) || null;
  return groups[target] || null;
}
export function resolvePolicyTarget(result, options = {}) {
  if (!result || result.ok !== true) return { ok: false, action: { type: "reject" }, error: "invalid policy result" };
  const action = result.action || {};
  if ((action.type !== "route" && action.type !== "chain") || !options.groups) return result;
  const group = groupForTarget(options.groups, action.target);
  if (!group) return result;
  const resolver = typeof options.resolveGroupMember === "function" ? options.resolveGroupMember : resolveGroupMember;
  const selected = resolver(group, options.nodes || [], options.states, options.groupContext || {});
  if (!selected || selected.ok !== true || !selected.member || !selected.member.id) return { ok: false, action: { type: "reject" }, rule: result.rule || null, error: selected?.reason || "no usable group member" };
  return { ...result, action: { ...action, target: selected.member.id, group: group.id }, group, member: selected.member, selectionReason: selected.reason };
}
export function resolveRoutingDecision(policyInput, facts = {}, options = {}) {
  const result = resolveRoutingPolicy(policyInput, facts, options);
  if (!result.ok) return result;
  return resolvePolicyTarget(result, options);
}
