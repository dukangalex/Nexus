import {
  PlatformCapabilities,
  createPlatformContract,
  getPlatformCapabilityRequirements,
} from "./contract.js";

function capabilityStatus(platform, capability) {
  const supported = platform.capabilities.includes(capability);
  return Object.freeze({
    capability,
    supported,
    requiredMethods: getPlatformCapabilityRequirements(capability),
  });
}

export function inspectPlatformCapabilities(implementation) {
  const platform = createPlatformContract(implementation);
  const capabilities = Object.values(PlatformCapabilities).map((capability) =>
    capabilityStatus(platform, capability),
  );

  return Object.freeze({
    platform: platform.platform,
    capabilities: Object.freeze(capabilities),
  });
}
