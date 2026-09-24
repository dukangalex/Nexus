import { sniff } from "./sniffer.js";
import { adapterFor } from "../adapters/index.js";
import { validateChain } from "./chain.js";
import { Kernels } from "./model.js";

export class ProxyCoreController {
  constructor() {
    this.state = { kernel: null, config: null, chain: null, adapter: null };
  }

  load(input, { kernel = null } = {}) {
    const detected = sniff(input);
    const selected = kernel || detected.kernel;

    if (!selected && detected.candidates.length > 1) {
      throw new Error("configuration format is ambiguous; select a kernel: " + detected.candidates.join(", "));
    }
    if (!selected || !Object.values(Kernels).includes(selected)) {
      throw new Error("unsupported configuration format");
    }
    if (detected.candidates.length && !detected.candidates.includes(selected)) {
      throw new Error("selected kernel is incompatible with detected format");
    }

    this.state.kernel = selected;
    this.state.config = input;
    this.state.adapter = adapterFor(selected);
    return { ...detected, kernel: selected, selection: kernel ? "explicit" : "detected" };
  }

  setChain(mode, hops) {
    const v = validateChain(mode, hops);
    if (!v.ok) throw new Error(v.error);
    this.state.chain = v.data;
    return v.data;
  }

  snapshot() {
    return { ...this.state };
  }
}
