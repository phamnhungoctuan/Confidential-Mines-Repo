/* eslint-disable no-undef */

importScripts("/fhevm-worker.js");

let fhevm = null;

self.onmessage = async (e) => {
  const { board, contractAddress, userAddress, sdkConfig } = e.data;

  try {
    // 🔍 Detect SDK global
    const PossibleSDK = self.RelayerSDK || self.relayerSDK || self.fhevm || self.FHE || self.Zama || null;
    if (!PossibleSDK) {
      throw new Error("FHE SDK global not found");
    }

    // I will check more
    if (!fhevm) {
      let instanceCreator = null;

      if (typeof PossibleSDK === "function") {
        // RelayerSDK style
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
        throw new Error("createInstance()");
      }

      fhevm = await instanceCreator.createInstance(sdkConfig);
    }

    const buf = fhevm.createEncryptedInput(contractAddress, userAddress);

    console.time("⏱ add32");
    board.forEach((v) => buf.add32(BigInt(v)));
    console.timeEnd("⏱ add32");

    console.time("⏱ buf.encrypt()");
    const result = await buf.encrypt();
    console.timeEnd("⏱ buf.encrypt()");

    self.postMessage({
      encryptedTiles: result.handles, // externalEuint32[]
      inputProof: result.inputProof, // 1 proof chung cho tất cả
    });
  } catch (err) {
    console.error("❌ Worker encrypt error:", err);
    self.postMessage({ error: err?.message || String(err) });
  }
};
