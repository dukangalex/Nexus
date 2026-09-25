# Nexus Platform Architecture

Nexus is a real cross-platform proxy application from the first architectural layer.

## Target platforms

- Android
- iOS
- Windows
- macOS
- Linux

No platform is the architectural primary target. Platform-specific capabilities are exposed through contracts and implemented independently.

## Runtime layers

```
Nexus UI
   |
Application / Orchestration
   |
Platform-neutral Core
   |-- configuration
   |-- subscription
   |-- routing
   |-- chain
   |-- DNS/security policy
   |-- health/self-healing
   |-- kernel selection
   |
Kernel Adapter
   |-- Mihomo
   |-- sing-box
   |-- Xray
   |
Platform Contract
   |-- TUN/VPN
   |-- system proxy
   |-- process/application exclusion
   |-- network state
   |-- lifecycle
   |-- notifications
   |-- secure storage
   |
Native Platform Implementation
   |-- Android
   |-- iOS
   |-- Windows
   |-- macOS
   `-- Linux
```

## Non-negotiable boundary

The core must not import Android, iOS, Windows, macOS or Linux APIs.

Platform implementations may depend on native APIs, but the reverse dependency is forbidden.

## Real-world constraints

Platform capabilities are not assumed to be identical.

- Android VPN integration is based on Android VpnService and the selected kernel's supported embedding interface.
- Apple transparent proxying requires Network Extension / platform-specific service integration; iOS and macOS capabilities differ.
- Windows transparent proxying can require WFP/TUN integration and elevated installation/service capabilities.
- Linux integration may use TUN plus routing/iproute2 or firewall facilities.
- System proxy support is an optional platform capability and is not equivalent to TUN/VPN.

Feature availability must be capability-driven, not hard-coded as if all platforms were identical.

## Kernel policy

The core selects a kernel through an adapter contract. Kernel-specific configuration syntax remains inside adapters.

No kernel is a permanent production-primary target. Mihomo, sing-box and Xray remain first-class adapters; native embedding must be verified independently for each selected kernel and platform before production support is claimed.

## Evidence rule

A feature is considered implemented only when one of the following exists:

1. upstream source/API/schema proves the integration;
2. a reproducible build/test proves it;
3. a platform implementation is present and exercised.

Architectural placeholders must be explicitly marked as such and must not be presented as working features.
