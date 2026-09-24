import { Kernels, NodeProtocols } from "./model.js";

export const ConstraintSeverity = Object.freeze({ ERROR: "error", WARNING: "warning" });

function issue(severity, code, message, kernel, evidence) {
  return { severity, code, message, kernel, evidence };
}

const EVIDENCE = Object.freeze({
  mihomo: "https://wiki.metacubex.one/en/config/proxies/anytls/",
  "sing-box": "https://sing-box.sagernet.org/configuration/shared/tls/",
  xray: "https://xtls.github.io/en/config/transport/"
});

export function validateNodeCombination(kernel, node = {}) {
  const protocol = String(node.protocol || node.type || "").trim().toLowerCase();
  const tls = node.tls && typeof node.tls === "object" ? node.tls : {};
  const transport = node.transport && typeof node.transport === "object" ? node.transport : {};
  const reality = node.reality || tls.reality || null;
  const realityEnabled = Boolean(reality && typeof reality === "object" ? (reality.enabled !== false) : reality);
  const transportType = String(node.network || transport.type || "").trim().toLowerCase();
  const issues = [];
  const evidence = EVIDENCE[kernel];

  if (kernel === Kernels.MIHOMO && protocol === NodeProtocols.ANYTLS && realityEnabled) {
    issues.push(issue(ConstraintSeverity.ERROR, "MIHOMO_ANYTLS_REALITY_UNSUPPORTED", "Mihomo does not support AnyTLS with Reality.", kernel, evidence));
  }

  if (kernel === Kernels.SING_BOX && realityEnabled) {\n    issues.push(issue(ConstraintSeverity.ERROR, "SING_BOX_REALITY_UNSUPPORTED", "The current sing-box TLS schema does not support Reality.", kernel, evidence));\n  }\n\n  if (kernel === Kernels.XRAY && protocol === NodeProtocols.HYSTERIA) {
    if (node.version !== undefined && Number(node.version) !== 2) {
      issues.push(issue(ConstraintSeverity.ERROR, "XRAY_HYSTERIA_VERSION", "Xray Hysteria outbound requires version 2.", kernel, "https://xtls.github.io/en/config/outbounds/hysteria.html"));
    }
    if (realityEnabled) {
      issues.push(issue(ConstraintSeverity.ERROR, "XRAY_HYSTERIA_REALITY_UNSUPPORTED", "Xray Hysteria cannot use REALITY transport security.", kernel, evidence));
    }
    if (transportType && transportType !== "hysteria") {
      issues.push(issue(ConstraintSeverity.WARNING, "XRAY_HYSTERIA_NON_NATIVE_TRANSPORT", "Xray documents that Hysteria with a non-Hysteria transport cannot proxy UDP and is not recommended.", kernel, "https://xtls.github.io/en/config/outbounds/hysteria.html"));
    }
  }

  if (kernel === Kernels.XRAY && realityEnabled && !["", "raw", "xhttp", "grpc"].includes(transportType)) {
    issues.push(issue(ConstraintSeverity.ERROR, "XRAY_REALITY_TRANSPORT", "Xray REALITY is only valid with RAW, XHTTP, or gRPC transport.", kernel, "https://xtls.github.io/en/config/transport.html"));
  }

  return issues;
}

export function validateNodeCombinations(kernel, nodes = []) {
  const results = [];
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const issues = validateNodeCombination(kernel, node);
    if (issues.length) results.push({ id: node.id || node.name || null, issues });
  }
  return {
    kernel,
    ok: results.every(item => item.issues.every(item => item.severity !== ConstraintSeverity.ERROR)),
    results,
    errors: results.flatMap(item => item.issues.filter(item => item.severity === ConstraintSeverity.ERROR)),
    warnings: results.flatMap(item => item.issues.filter(item => item.severity === ConstraintSeverity.WARNING))
  };
}
