/* eslint-disable no-undef */

// ⚡ Load SDK wrapper (exposes globals on self)
importScripts("/fhevm-worker.js");

let fhevm = null;

self.onmessage = async (e) => {
  const { value, contractAddress, userAddress, sdkConfig } = e.data;

  try {
    // Detect available SDK global
    const PossibleSDK = self.RelayerSDK || self.relayerSDK || self.fhevm || self.FHE || self.Zama || null;
    if (!PossibleSDK) {
      throw new Error("⚠️ FHE SDK global not found after importScripts (expected RelayerSDK or fhevm)");
    }

    if (!fhevm) {
      // If legacy class exists, instantiate, else assume namespace with createInstance
      let instanceCreator = null;
      let maybeNeedsInit = null;

      if (typeof PossibleSDK === "function") {
        // RelayerSDK style
        maybeNeedsInit = new PossibleSDK();
        if (typeof maybeNeedsInit.initSDK === "function") {
          await maybeNeedsInit.initSDK();
        }
        instanceCreator = maybeNeedsInit;
      } else {
        // UMD namespace (fhevm) style
        instanceCreator = PossibleSDK;
        if (typeof instanceCreator.initSDK === "function") {
          await instanceCreator.initSDK();
        }
      }

      if (!instanceCreator || typeof instanceCreator.createInstance !== "function") {
        throw new Error("⚠️ SDK does not expose createInstance()");
      }

      fhevm = await instanceCreator.createInstance(sdkConfig);
    }

    const buf = fhevm.createEncryptedInput(contractAddress, userAddress);
    buf.add32(value);

    const result = await buf.encrypt();
    self.postMessage({
      encryptedData: result.handles[0],
      inputProof: result.inputProof,
    });
  } catch (err) {
    console.error("❌ Worker encrypt error:", err);
    self.postMessage({ error: err?.message || String(err) });
  }
};
