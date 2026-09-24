export const PlatformId = Object.freeze({
  ANDROID: "android",
  IOS: "ios",
  WINDOWS: "windows",
  MACOS: "macos",
  LINUX: "linux",
});

export const PlatformCapabilities = Object.freeze({
  TUN: "tun",
  SYSTEM_PROXY: "system-proxy",
  APP_EXCLUSION: "app-exclusion",
  PROCESS_EXCLUSION: "process-exclusion",
  NETWORK_MONITOR: "network-monitor",
  BACKGROUND_SERVICE: "background-service",
  NOTIFICATIONS: "notifications",
  SECURE_STORAGE: "secure-storage",
});

export function createPlatformContract(implementation) {
  if (!implementation || typeof implementation !== "object") {
    throw new TypeError("platform implementation is required");
  }

  const required = [
    "platform",
    "capabilities",
    "start",
    "stop",
    "getNetworkState",
  ];

  for (const key of required) {
    if (typeof implementation[key] === "undefined") {
      throw new TypeError("platform implementation missing: " + key);
    }
  }

  if (!Object.values(PlatformId).includes(implementation.platform)) {
    throw new TypeError("unsupported platform: " + implementation.platform);
  }

  return Object.freeze({
    ...implementation,
    capabilities: Object.freeze([...(implementation.capabilities || [])]),
  });
}
