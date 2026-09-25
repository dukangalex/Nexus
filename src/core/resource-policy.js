export const ResourceModes = Object.freeze({
  EFFICIENT: "efficient",
  BALANCED: "balanced",
  PERFORMANCE: "performance",
  CUSTOM: "custom"
});

export const ResourcePolicy = Object.freeze({
  userControls: Object.freeze([
    "resourceMode",
    "backgroundMonitoring",
    "healthCheckInterval",
    "telemetryLevel",
    "logLevel",
    "connectionIdleTimeout",
    "dnsCachePolicy",
    "ruleSetRefreshPolicy"
  ]),
  defaults: Object.freeze({
    mode: ResourceModes.BALANCED,
    backgroundMonitoring: "adaptive",
    healthCheckInterval: "adaptive",
    telemetryLevel: "minimal",
    logLevel: "warning",
    dnsCachePolicy: "bounded",
    ruleSetRefreshPolicy: "scheduled"
  }),
  principles: Object.freeze([
    "do-not-run-duplicate-kernels",
    "do-not-poll-when-event-driven-observation-is-available",
    "do-not-probe-idle-nodes-unnecessarily",
    "bound-caches-and-logs",
    "reduce-background-work-when-device-is-idle-or-low-power",
    "preserve-security-and-routing-correctness-over-resource-savings"
  ])
});

const VALID = new Set(Object.values(ResourceModes));

export function createResourcePolicy(input = {}) {
  const mode = input.mode || ResourcePolicy.defaults.mode;
  if (!VALID.has(mode)) throw new Error("unsupported resource mode: " + mode);

  return Object.freeze({
    mode,
    backgroundMonitoring: input.backgroundMonitoring || ResourcePolicy.defaults.backgroundMonitoring,
    healthCheckInterval: input.healthCheckInterval || ResourcePolicy.defaults.healthCheckInterval,
    telemetryLevel: input.telemetryLevel || ResourcePolicy.defaults.telemetryLevel,
    logLevel: input.logLevel || ResourcePolicy.defaults.logLevel,
    connectionIdleTimeout: input.connectionIdleTimeout || ResourcePolicy.defaults.connectionIdleTimeout,
    dnsCachePolicy: input.dnsCachePolicy || ResourcePolicy.defaults.dnsCachePolicy,
    ruleSetRefreshPolicy: input.ruleSetRefreshPolicy || ResourcePolicy.defaults.ruleSetRefreshPolicy
  });
}

export function getResourcePolicy() {
  return ResourcePolicy;
}
