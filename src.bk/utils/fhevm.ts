// 🌐 Khai báo global để không lỗi TS
declare global {
  interface Window {
    [key: string]: any;
  }
}

let fhevmInstance: any = null;
let sdkInitialized = false;

/**
 * ⚡ Khởi tạo FHEVM Instance
 * - Tự dò SDK từ window (RelayerSDK / fhevm / Zama / FHE)
 * - Hỗ trợ cả SDK mới (window.fhevm)
 */
export async function initializeFHE() {
  try {
    if (!fhevmInstance) {
      console.log("🔍 Checking available global objects...");
      console.log(
        "Available keys:",
        Object.keys(window).filter(
          (key) =>
            key.toLowerCase().includes("relayer") ||
            key.toLowerCase().includes("fhe") ||
            key.toLowerCase().includes("zama"),
        ),
      );

      const possibleNames = ["fhevm", "RelayerSDK", "FHE", "Zama", "relayerSDK", "fhe"];
      let sdk: any = null;

      for (const name of possibleNames) {
        if (window[name]) {
          sdk = window[name];
          console.log(`✅ Found SDK at window.${name}:`, sdk);
          break;
        }
      }

      if (!sdk) {
        if (window.initSDK && window.createInstance) {
          sdk = window;
          console.log("⚡ Found SDK functions directly on window object");
        } else {
          throw new Error("⚠️ FHE SDK not found. Available window keys: " + Object.keys(window).join(", "));
        }
      }

      // Gọi initSDK() nếu có (chỉ bản RelayerSDK cũ mới cần)
      if (!sdkInitialized && sdk.initSDK) {
        console.log("⚙️ Initializing FHE SDK from CDN...");
        await sdk.initSDK();
        sdkInitialized = true;
        console.log("✅ FHE SDK initialized successfully");
      }

      console.log("⚡ Creating FHEVM instance...");

      const config = {
        aclContractAddress: "0x687820221192C5B662b25367F70076A37bc79b6c",
        kmsContractAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
        inputVerifierContractAddress: "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4",
        verifyingContractAddressDecryption: "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1",
        verifyingContractAddressInputVerification: "0x7048C39f048125eDa9d678AEbaDfB22F7900a29F",
        chainId: 11155111,
        gatewayChainId: 55815,
        relayerUrl: "https://relayer.testnet.zama.cloud",
        network: (window as any).ethereum || "https://eth-sepolia.public.blastapi.io",
      };

      fhevmInstance = await sdk.createInstance(config);

      console.log("✅ FHEVM SDK instance initialized successfully");
    }

    return fhevmInstance;
  } catch (error) {
    console.error("❌ Failed to initialize FHEVM SDK:", error);
    throw error;
  }
}

/** 📦 Lấy instance đã khởi tạo */
export async function getFhevmInstance() {
  if (!fhevmInstance) {
    await initializeFHE();
  }
  return fhevmInstance;
}

/** 🔒 Mã hoá số 32-bit */
export async function encryptNumber(
  value: number,
  contractAddress: string,
  userAddress: string,
): Promise<{ encryptedData: string; inputProof: string }> {
  const instance = await getFhevmInstance();
  const buffer = instance.createEncryptedInput(contractAddress, userAddress);
  buffer.add32(value);
  const ciphertexts = await buffer.encrypt();

  const toHex = (uint8Array: Uint8Array): string =>
    "0x" +
    Array.from(uint8Array)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return {
    encryptedData:
      ciphertexts.handles[0] instanceof Uint8Array ? toHex(ciphertexts.handles[0]) : ciphertexts.handles[0],
    inputProof: ciphertexts.inputProof instanceof Uint8Array ? toHex(ciphertexts.inputProof) : ciphertexts.inputProof,
  };
}

/** ⚙️ Reset instance (dùng cho test hoặc reload) */
export function resetFhevmInstance() {
  fhevmInstance = null;
}
