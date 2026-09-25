import { adapterFor } from "../adapters/index.js";
import { AdapterCapabilities, hasAdapterCapability } from "../adapters/contract.js";
import { resolveChain } from "./chain-resolution.js";
import { validateUnifiedCompatibility } from "./compatibility.js";
import { validateCompiledConfig } from "./compiled-config-validation.js";

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

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

function chainMode(chain) {
  return typeof chain?.mode === "string" && chain.mode.trim() ? chain.mode : "node->node";
}

function resolveConfiguredChains(config) {
  const resolved = new Map();
  for (const chain of chainList(config.chains)) {
    const id = String(chain.id).trim();
    const hops = chainHops(chain);
    const result = resolveChain(hops, {
      nodes: config.nodes,
      groups: config.groups,
      states: config.states,
      maxDepth: chain.maxDepth
    });
    if (!result.ok) throw new Error("chain " + id + " cannot be safely compiled: " + result.error);
    const resolvedHops = result.data.hops.map((node) => clone(node));
    resolved.set(id, { id, mode: chainMode(chain), hops: resolvedHops });
  }
  return resolved;
}

function rewriteAction(action, chains) {
  if (!action || typeof action !== "object") return action;
  if (action.type !== "chain") return clone(action);
  const chain = chains.get(action.target);
  if (!chain) throw new Error("routing references missing chain: " + action.target);
  const finalHop = chain.hops[chain.hops.length - 1];
  if (!finalHop?.id) throw new Error("routing chain has no final hop: " + action.target);
  return { ...clone(action), target: finalHop.id };
}

function routingForKernel(routing, chains) {
  const source = clone(routing || {});
  if (!chains.size || !source || typeof source !== "object") return source;
  if (Array.isArray(source.rules)) {
    source.rules = source.rules.map((rule) => rule && rule.action ? { ...rule, action: rewriteAction(rule.action, chains) } : rule);
  }
  if (source.defaultAction) source.defaultAction = rewriteAction(source.defaultAction, chains);
  return source;
}

function compileResolvedChains(adapter, compiled, chains) {
  let output = compiled;
  for (const chain of chains.values()) output = adapter.compileChain(output, chain);
  return output;
}

export function compileUnifiedConfig(config, kernel = config && config.kernel) {
  if (!config || typeof config !== "object") {
    throw new TypeError("unified configuration is required");
  }

  const adapter = adapterFor(kernel);
  if (!adapter) throw new Error("unsupported kernel: " + kernel);
  if (!hasAdapterCapability(adapter, AdapterCapabilities.CONFIG_COMPILE)) {
    throw new Error("kernel does not implement config compilation: " + kernel);
  }

  const compatibility = validateUnifiedCompatibility(config, kernel);
  if (!compatibility.ok) {
    const ids = compatibility.unknown.concat(compatibility.unsupported).map((item) => item.id || "unknown");
    const constraintIds = compatibility.constraintErrors.map((item) => item.code);
    const details = ids.concat(constraintIds);
    throw new Error(
      "configuration is not safely compilable for " + kernel +
      (details.length ? ": " + details.join(", ") : "")
    );
  }

  const resolvedChains = resolveConfiguredChains(config);
  const kernelConfig = { ...config, routing: routingForKernel(config.routing, resolvedChains) };
  const compiledBase = adapter.compileConfig(kernelConfig);
  const compiled = resolvedChains.size ? compileResolvedChains(adapter, compiledBase, resolvedChains) : compiledBase;
  const validation = validateCompiledConfig(compiled, kernel);
  if (!validation.ok) {
    throw new Error("compiled configuration failed structural validation for " + kernel + ": " + validation.errors.join("; "));
  }

  return {
    kernel,
    status: "compiled",
    config: compiled,
    validation,
    compatibility,
    chains: [...resolvedChains.values()].map((chain) => ({
      id: chain.id,
      mode: chain.mode,
      hops: chain.hops.map((node) => node.id)
    }))
  };
}
