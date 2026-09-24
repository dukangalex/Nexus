import { sniff } from "./sniffer.js";
import { parseSubscription } from "./subscription.js";
import { normalizeNodeConfig } from "./config.js";
import { Kernels } from "./model.js";

function validateKernel(kernel) {
  if (kernel === null || kernel === undefined) return null;
  if (!Object.values(Kernels).includes(kernel)) {
    throw new Error("unsupported kernel: " + kernel);
  }
  return kernel;
}

function promptFor(detected, selected, explicit) {
  if (explicit) {
    return {
      required: false,
      title: "Kernel binding",
      message: "The selected kernel will be used for this import.",
      reason: "user-selected"
    };
  }

  if (selected) {
    return {
      required: false,
      title: "Kernel detected",
      message: "Nexus detected " + selected + " from the input format and bound it automatically.",
      reason: detected.confidence
    };
  }

  return {
    required: true,
    title: "Kernel selection required",
    message: "The input format cannot be bound to one kernel with sufficient confidence.",
    reason: detected.confidence,
    options: detected.candidates.slice()
  };
}

export function inspectImport(input, { kernel = null } = {}) {
  const detected = sniff(input);
  const explicit = kernel !== null && kernel !== undefined;
  const selected = validateKernel(kernel) || detected.kernel;

  if (explicit && detected.candidates.length && !detected.candidates.includes(selected)) {
    throw new Error("selected kernel is incompatible with detected format");
  }

  const prompt = promptFor(detected, selected, explicit);
  return {
    detection: detected,
    binding: {
      kernel: selected,
      mode: explicit ? "explicit" : (selected ? "automatic" : "pending"),
      candidates: detected.candidates.slice(),
      requiresConfirmation: prompt.required,
      prompt
    }
  };
}

export function importConfig(input, { kernel = null, maxNodes = null } = {}) {
  const inspection = inspectImport(input, { kernel });
  if (!inspection.binding.kernel) {
    throw new Error("kernel selection is required before import");
  }

  let nodes;
  if (typeof input === "string") {
    nodes = parseSubscription(input, { maxNodes });
  } else if (input && typeof input === "object" && !Array.isArray(input)) {
    const candidates = Array.isArray(input.proxies)
      ? input.proxies
      : Array.isArray(input.nodes)
        ? input.nodes
        : Array.isArray(input.outbounds)
          ? input.outbounds.filter((item) => item && item.type && !["selector", "urltest", "direct", "block", "dns"].includes(item.type))
          : [];
    nodes = normalizeNodeConfig(candidates, maxNodes);
  } else {
    throw new TypeError("import input must be text or object");
  }

  return {
    ...inspection,
    model: {
      nodes,
      nodeCount: nodes.length,
      nodeLimit: maxNodes
    }
  };
}
