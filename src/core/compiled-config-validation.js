import { Kernels } from "./model.js";

function nonEmptyObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function validateCompiledConfig(config, kernel) {
  const errors = [];

  if (!nonEmptyObject(config)) {
    errors.push("compiled configuration must be an object");
  } else if (kernel === Kernels.MIHOMO) {
    if (!Array.isArray(config.proxies)) errors.push("Mihomo compiled configuration requires proxies");
  } else if (kernel === Kernels.SING_BOX || kernel === Kernels.XRAY) {
    if (!Array.isArray(config.outbounds)) errors.push(kernel + " compiled configuration requires outbounds");
  } else {
    errors.push("unsupported kernel: " + kernel);
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
