import { adapterFor } from "../adapters/index.js";
import { AdapterCapabilities, hasAdapterCapability } from "../adapters/contract.js";
import { compileGroups } from "./group-compiler.js";
import { resolveChain } from "./chain-resolution.js";
import { validateUnifiedCompatibility } from "./compatibility.js";
import { validateCompiledConfig } from "./compiled-config-validation.js";

function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function chainList(chains) {
  if (Array.isArray(chains)) return chains.filter((chain) => chain && chain.id);
  if (chains && typeof chains === "object") return Object.values(chains).filter((chain) => chain && chain.id);
  return [];
}
function chainHops(chain) {
  if (!chain || typeof chain !== "object") return [];
  if (Array.isArray(chain.hops)) return chain.hops;
  if (Array.isArray(chain.chain)) return chain.chain;
  if (chain.chain && typeof chain.chain === "object" && Array.isArray(chain.chain.hops)) return chain.chain.hops;
  return [];
}
function chainMode(chain) { return typeof chain?.mode === "string" && chain.mode.trim() ? chain.mode : "node->node"; }
function resolveConfiguredChains(config) {
  const resolved = new Map();
  for (const chain of chainList(config.chains)) {
    const id = String(chain.id).trim();
    const resolvedChain = resolveChain(chainHops(chain), { nodes: config.nodes, groups: config.groups, states: config.states, maxDepth: chain.maxDepth });
    if (!resolvedChain.ok) throw new Error("chain " + id + " cannot be safely compiled: " + resolvedChain.error);
    resolved.set(id, { id, mode: chainMode(chain), hops: resolvedChain.data.hops.map((node) => clone(node)) });
  }
  return resolved;
}
function nodeTargetMap(config) {
  const map = new Map();
  for (const node of Array.isArray(config.nodes) ? config.nodes : []) {
    if (!node || !node.id) continue;
    map.set(String(node.id).trim(), String(node.name || node.id).trim());
  }
  return map;
}
function rewriteAction(action, chains, groups, nodes) {
  if (!action || typeof action !== "object") return action;
  if (action.type === "chain") {
    const target = String(action.target || "").trim();
    const chain = chains.get(target);
    if (!chain) throw new Error("routing references missing chain: " + target);
    const finalHop = chain.hops[chain.hops.length - 1];
    if (!finalHop?.id) throw new Error("routing chain has no final hop: " + target);
    return { ...clone(action), type: "route", target: nodes.get(finalHop.id) || finalHop.id };
  }
  if (action.type === "route") {
    const target = String(action.target || "").trim();
    if (!target) throw new Error("routing route action requires target");
    const resolved = groups.targetMap.get(target) || nodes.get(target);
    if (!resolved) throw new Error("routing references missing node or group: " + target);
    return { ...clone(action), target: resolved };
  }
  return clone(action);
}
function routingForKernel(routing, chains, groups, nodes) {
  const source = clone(routing || {});
  if (!source || typeof source !== "object") return source;
  if (Array.isArray(source.rules)) source.rules = source.rules.map((rule) => rule && rule.action ? { ...rule, action: rewriteAction(rule.action, chains, groups, nodes) } : rule);
  if (source.defaultAction) source.defaultAction = rewriteAction(source.defaultAction, chains, groups, nodes);
  return source;
}
function compileResolvedChains(adapter, compiled, chains) {
  let output = compiled;
  for (const chain of chains.values()) output = adapter.compileChain(output, chain);
  return output;
}
export function compileUnifiedConfig(config, kernel = config && config.kernel) {
  if (!config || typeof config !== "object") throw new TypeError("unified configuration is required");
  const adapter = adapterFor(kernel);
  if (!adapter) throw new Error("unsupported kernel: " + kernel);
  if (!hasAdapterCapability(adapter, AdapterCapabilities.CONFIG_COMPILE)) throw new Error("kernel does not implement config compilation: " + kernel);
  const compatibility = validateUnifiedCompatibility(config, kernel);
  if (!compatibility.ok) {
    const ids = compatibility.unknown.concat(compatibility.unsupported).map((item) => item.id || "unknown");
    const constraintIds = compatibility.constraintErrors.map((item) => item.code);
    const details = ids.concat(constraintIds);
    throw new Error("configuration is not safely compilable for " + kernel + (details.length ? ": " + details.join(", ") : ""));
  }
  const resolvedChains = resolveConfiguredChains(config);
  const compiledGroups = compileGroups(config.groups, kernel, config.nodes);
  const nodeTargets = nodeTargetMap(config);
  const kernelConfig = {
    ...config,
    groups: compiledGroups.groups,
    routing: routingForKernel(config.routing, resolvedChains, compiledGroups, nodeTargets),
  };
  const compiledBase = adapter.compileConfig(kernelConfig);
  const compiled = resolvedChains.size ? compileResolvedChains(adapter, compiledBase, resolvedChains) : compiledBase;
  const validation = validateCompiledConfig(compiled, kernel);
  if (!validation.ok) throw new Error("compiled configuration failed structural validation for " + kernel + ": " + validation.errors.join("; "));
  return {
    kernel,
    status: "compiled",
    config: compiled,
    validation,
    compatibility,
    groups: [...compiledGroups.targetMap.entries()].map(([id, target]) => ({ id, target })),
    chains: [...resolvedChains.values()].map((chain) => ({ id: chain.id, mode: chain.mode, hops: chain.hops.map((node) => node.id) })),
  };
}