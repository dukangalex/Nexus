# Nexus Roadmap

## Product architecture principle

Nexus is the unified capability and policy center:

- one user-facing UI and one operating model;
- one kernel-neutral routing/policy model;
- one capability model shared by Mihomo, sing-box and Xray;
- platform-specific and kernel-specific work stays behind adapters;
- automatic analysis may detect, validate, measure and diagnose, but policy-changing decisions remain explicit and user-controlled;
- common behavior is visible in Nexus; implementation details are delegated to the appropriate kernel/platform component.

## Current foundation

- Kernel-neutral core and controller.
- First-class Mihomo, sing-box and Xray adapters.
- Automatic format sniffing and explicit kernel binding.
- Unified node model, subscription parsing and region grouping.
- Kernel-neutral chain model with adapter-specific compilation.
- Versioned upstream compatibility registry.
- Explicit unified routing-policy model.
- Explicit resource-efficiency policy model.

## Unified routing scope

The routing layer is designed to expose common behavior consistently:

- rule / global modes;
- domain, IP/CIDR, port and network matching;
- GeoIP / domain-set and rule-set matching;
- application/process matching where the platform and kernel expose it;
- logical AND/OR/NOT conditions;
- explicit routing, DNS, bypass, reject and chain actions;
- selector, URL-test, fallback and load-balancing strategies where supported;
- rule ordering, conflict detection and rule-hit explanation;
- capability-aware compilation so unsupported or non-equivalent features are never silently degraded.

Kernel-specific differences remain visible through capability status and compile diagnostics rather than leaking different configuration concepts into the primary UI.

## Resource-efficiency design

Efficiency is a first-class requirement, especially for mobile and low-memory devices.

Nexus must prefer:

- event-driven observation over frequent polling;
- adaptive health checks rather than constant probing of idle nodes;
- bounded logs, caches and telemetry;
- scheduled rule-set refreshes rather than unnecessary background refreshes;
- one active kernel/runtime rather than duplicated kernel processes;
- reduced background work while the device is idle or under low-power conditions;
- security and routing correctness over resource savings.

Resource mode is an explicit user policy (`efficient`, `balanced`, `performance`, `custom`) rather than a hidden quality downgrade.

The system must measure actual CPU, memory, battery/background activity, connection counts and kernel-specific telemetry where available before making optimization claims.

## Next implementation targets

1. Schema-aware and version-aware validation for each kernel.
2. Protocol/feature capability registry with evidence and combination constraints.
3. Continuous upstream release detection and controlled adapter updates.
4. Real kernel integration tests against pinned upstream binaries/config validators.
5. TUN/VPN platform bridges and process exclusion across all five target platforms.
6. Unified routing compiler for Mihomo, sing-box and Xray.
7. Unified UI for explicit routing, strategies, DNS, chain, security and runtime state.
8. Resource telemetry and adaptive low-power behavior with reproducible benchmarks.
9. Rule-hit explanation, diagnostics and safe repair suggestions.

## Community-derived engineering constraints

Recent upstream issue/discussion reports show that resource behavior can regress across versions and workloads. Nexus therefore treats memory, goroutine/connection growth, TUN loopback, DNS processing, logging volume and health-probe frequency as observable runtime risks rather than assumptions.

These reports are signals for testing and telemetry, not proof that every device or version has the same behavior.

## Update policy

Upstream releases are detected automatically. A detected stable-version drift must trigger review of release notes, configuration schemas, protocol support, adapter compilers, fixtures and regression tests before the Nexus baseline is changed.

No kernel is the permanent primary kernel. Each kernel has an independent upstream baseline and adapter maintenance path.