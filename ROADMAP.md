# Nexus Roadmap

## Current foundation

- Kernel-neutral core and controller.
- First-class Mihomo, sing-box and Xray adapters.
- Automatic format sniffing and explicit kernel binding.
- Unified node model, subscription parsing and region grouping.
- Kernel-neutral chain model with adapter-specific compilation.
- Versioned upstream compatibility registry.

## Next implementation targets

1. Schema-aware and version-aware validation for each kernel.
2. Protocol/feature capability registry with evidence and combination constraints.
3. Continuous upstream release detection and controlled adapter updates.
4. Real kernel integration tests against pinned upstream binaries/config validators.
5. TUN/VPN platform bridges and process exclusion across all five target platforms.
6. Unified UI, live telemetry, diagnostics and explainable automation.

## Update policy

Upstream releases are detected automatically. A detected stable-version drift must trigger review of release notes, configuration schemas, protocol support, adapter compilers, fixtures and regression tests before the Nexus baseline is changed.

No kernel is the permanent primary kernel. Each kernel has an independent upstream baseline and adapter maintenance path.
