import { adapterFor } from "../adapters/index.js";
import { AdapterCapabilities, hasAdapterCapability } from "../adapters/contract.js";
import { validateUnifiedCompatibility } from "./compatibility.js";
import { validateCompiledConfig } from "./compiled-config-validation.js";
import { compileRoutingPolicy } from "./routing-compiler.js";

function applyCompiledRouting(compiled, config, kernel) {
  if (!config.routing || typeof config.routing !== "object" || !Array.isArray(config.routing.rules)) {
    return compiled;
  }

  const rules = compileRoutingPolicy(config.routing, kernel);
  const output = structuredClone(compiled);

  if (kernel === "mihomo") {
    output.rules = rules;
    return output;
  }

  if (kernel === "sing-box") {
    output.route = { rules };
    const needsDirect = config.routing.rules.some((rule) => rule.enabled && rule.action?.type === "bypass");
    if (needsDirect && !output.outbounds.some((item) => item && item.tag === "__nexus_direct")) {
      output.outbounds.push({ type: "direct", tag: "__nexus_direct" });
    }
    return output;
  }

  output.routing = {
    domainStrategy: config.routing.domainStrategy || "AsIs",
    rules
  };

  const needsDirect = config.routing.rules.some((rule) => rule.enabled && rule.action?.type === "bypass");
  const needsBlock = config.routing.rules.some((rule) => rule.enabled && rule.action?.type === "reject");

  if (needsDirect && !output.outbounds.some((item) => item && item.tag === "__nexus_direct")) {
    output.outbounds.push({
      protocol: "freedom",
      tag: "__nexus_direct",
      settings: {}
    });
  }

  if (needsBlock && !output.outbounds.some((item) => item && item.tag === "__nexus_block")) {
    output.outbounds.push({
      protocol: "blackhole",
      tag: "__nexus_block",
      settings: {}
    });
  }

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

  const compiled = applyCompiledRouting(adapter.compileConfig(config), config, kernel);
  const validation = validateCompiledConfig(compiled, kernel);
  if (!validation.ok) {
    throw new Error("compiled configuration failed structural validation for " + kernel + ": " + validation.errors.join("; "));
  }

  return {
    kernel,
    status: "compiled",
    config: compiled,
    validation,
    compatibility
  };
}

export { applyCompiledRouting };
