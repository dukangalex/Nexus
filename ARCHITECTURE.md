# Nexus Architecture

## Layers
- UI: unified card-based console (planned)
- Adapter: Mihomo / sing-box / Xray, network monitor, format sniffer, chain compiler, self-healing
- Core: kernel orchestration and security policy

## Chain
Four explicit modes are modeled: node→node, node→subscription, subscription→node, subscription→subscription. Kernel-specific mechanisms are isolated in adapters.

## Security
Fail-closed Kill Switch, WebRTC UDP/3478 blocking, IPv6 leak protection and encrypted DNS policy are first-class controls.

## Roadmap
1. Core decoupling and controller
2. Format sniffing and kernel integration
3. Chain compiler, network adaptation, China bypass
4. Resource optimization, security center, self-healing and LAN gateway
