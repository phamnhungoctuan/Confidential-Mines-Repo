/* eslint-disable no-undef */

importScripts("/fhevm-worker.js");

let fhevm = null;

self.onmessage = async (e) => {
  const { packedBoard, contractAddress, userAddress, sdkConfig } = e.data;
  const fallbackConfig =
    (self.RelayerSDK && self.RelayerSDK.SepoliaConfig) ||
    (self.relayerSDK && self.relayerSDK.SepoliaConfig) ||
    null;
  const config = sdkConfig || fallbackConfig;

  try {
    // 🔍 Detect SDK global
    const PossibleSDK =
      self.RelayerSDK || self.relayerSDK || self.fhevm || self.FHE || self.Zama || null;
    if (!PossibleSDK) {
      throw new Error("FHE SDK global not found");
    }

    // Init instance if not yet
    if (!fhevm) {
      let instanceCreator = null;

      if (typeof PossibleSDK === "function") {
        const maybeNeedsInit = new PossibleSDK();
        if (typeof maybeNeedsInit.initSDK === "function") {
          await maybeNeedsInit.initSDK();
        }
        instanceCreator = maybeNeedsInit;
      } else {
        instanceCreator = PossibleSDK;
        if (typeof instanceCreator.initSDK === "function") {
          await instanceCreator.initSDK();
        }
      }

      if (!instanceCreator || typeof instanceCreator.createInstance !== "function") {
        throw new Error("Missing createInstance()");
      }

      if (!config) {
        throw new Error("Relayer SDK config missing");
      }

      fhevm = await instanceCreator.createInstance(config);
    }

    // 🔐 Build encrypted input
    const buf = fhevm.createEncryptedInput(contractAddress, userAddress);

    console.time("⏱ add64");
    buf.add64(BigInt(packedBoard)); // pack toàn bộ board vào 1 uint64
    console.timeEnd("⏱ add64");

    console.time("⏱ buf.encrypt()");
    const result = await buf.encrypt();
    console.timeEnd("⏱ buf.encrypt()");

    self.postMessage({
      encryptedBoard: result.handles[0], // externalEuint64
      inputProof: result.inputProof,
    });
  } catch (err) {
    console.error("❌ Worker encrypt error:", err);
    self.postMessage({ error: err?.message || String(err) });
  }
};
