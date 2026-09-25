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
    connectionIdleTimeout: 300,
    dnsCachePolicy: "bounded",
    ruleSetRefreshPolicy: "scheduled"
  }),
  modes: Object.freeze({
    [ResourceModes.EFFICIENT]: Object.freeze({
      backgroundMonitoring: "reduced",
      healthCheckInterval: "relaxed",
      telemetryLevel: "minimal",
      logLevel: "warning",
      connectionIdleTimeout: 600,
      dnsCachePolicy: "bounded",
      ruleSetRefreshPolicy: "scheduled"
    }),
    [ResourceModes.BALANCED]: Object.freeze({
      backgroundMonitoring: "adaptive",
      healthCheckInterval: "adaptive",
      telemetryLevel: "minimal",
      logLevel: "warning",
      connectionIdleTimeout: 300,
      dnsCachePolicy: "bounded",
      ruleSetRefreshPolicy: "scheduled"
    }),
    [ResourceModes.PERFORMANCE]: Object.freeze({
      backgroundMonitoring: "active",
      healthCheckInterval: "active",
      telemetryLevel: "standard",
      logLevel: "info",
      connectionIdleTimeout: 180,
      dnsCachePolicy: "bounded",
      ruleSetRefreshPolicy: "scheduled"
    })
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

  const modeDefaults = ResourcePolicy.modes[mode] || {};
  return Object.freeze({
    mode,
    backgroundMonitoring: input.backgroundMonitoring || modeDefaults.backgroundMonitoring || ResourcePolicy.defaults.backgroundMonitoring,
    healthCheckInterval: input.healthCheckInterval || modeDefaults.healthCheckInterval || ResourcePolicy.defaults.healthCheckInterval,
    telemetryLevel: input.telemetryLevel || modeDefaults.telemetryLevel || ResourcePolicy.defaults.telemetryLevel,
    logLevel: input.logLevel || modeDefaults.logLevel || ResourcePolicy.defaults.logLevel,
    connectionIdleTimeout: input.connectionIdleTimeout ?? modeDefaults.connectionIdleTimeout ?? ResourcePolicy.defaults.connectionIdleTimeout,
    dnsCachePolicy: input.dnsCachePolicy || modeDefaults.dnsCachePolicy || ResourcePolicy.defaults.dnsCachePolicy,
    ruleSetRefreshPolicy: input.ruleSetRefreshPolicy || modeDefaults.ruleSetRefreshPolicy || ResourcePolicy.defaults.ruleSetRefreshPolicy
  });
}

export function applyResourceState(policy, state = {}) {
  const source = createResourcePolicy(policy);
  const idle = state.idle === true;
  const lowPower = state.lowPower === true;
  const batterySaver = state.batterySaver === true;

  if (!idle && !lowPower && !batterySaver) return source;

  return Object.freeze({
    ...source,
    backgroundMonitoring: "reduced",
    healthCheckInterval: "relaxed",
    telemetryLevel: "minimal",
    logLevel: "warning",
    ruleSetRefreshPolicy: "scheduled"
  });
}

export function getResourcePolicy() {
  return ResourcePolicy;
}
