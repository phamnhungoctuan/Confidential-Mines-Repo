// services/relayer.ts
import { initSDK, createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";

let instance: any = null;

/**
 * Get a singleton Relayer SDK instance.
 * - Initializes the SDK once and reuses the same instance for all calls.
 * - Uses SepoliaConfig (testnet) for FHEVM.
 * refer: https://docs.zama.ai/protocol/relayer-sdk-guides/fhevm-relayer/decryption/user-decryption
 */
export async function getRelayerInstance() {
  if (!instance) {
    // Initialize the SDK and create an instance if it doesn't exist
    await initSDK();
    instance = await createInstance(SepoliaConfig);
  }
  return instance;
}

/**
 * Build an EIP712 message for user signing.
 * - The Relayer SDK generates the EIP712 typed data structure.
 * - The wallet will sign this to authorize decryption.
 *
 * @param instance Relayer instance
 * @param publicKey User's generated FHE public key
 * @param contractAddresses List of contracts this keypair is valid for
 * @param startTimeStamp Unix timestamp for when the request starts
 * @param durationDays Number of days the request remains valid
 * refer: https://docs.zama.ai/protocol/relayer-sdk-guides/fhevm-relayer/decryption/user-decryption#step-2-decrypt-the-ciphertext
 */
export function buildEIP712(
  instance: any,
  publicKey: string,
  contractAddresses: string[],
  startTimeStamp: string,
  durationDays: string
) {
  return instance.createEIP712(publicKey, contractAddresses, startTimeStamp, durationDays);
}

/**
 * Decrypt ciphertexts using user's keypair + wallet signature.
 * - The ciphertext handles (from the smart contract) are provided.
 * - The user proves ownership with a signature over the EIP712 message.
 * - The Relayer returns the plaintext values.
 *
 * @param ciphertexts Array of ciphertext handles from the blockchain
 * @param contractAddress The address of the ConfidentialBomb contract
 * @param instance Relayer instance
 * @param keypair User-generated FHE keypair (public/private)
 * @param signature Signed EIP712 message from the user's wallet
 * @param signerAddress Ethereum wallet address of the user
 * @param startTimeStamp Timestamp when this request starts
 * @param durationDays How long the request is valid
 * Refer: https://docs.zama.ai/protocol/relayer-sdk-guides/fhevm-relayer/decryption/user-decryption
 */
export async function decryptBoard(
  ciphertexts: string[],
  contractAddress: string,
  instance: any,
  keypair: { publicKey: string; privateKey: string },
  signature: string,
  signerAddress: string,
  startTimeStamp: string,
  durationDays: string
) {
  // Pair each ciphertext handle with the contract address
  const handleContractPairs = ciphertexts.map((h) => ({
    handle: h,
    contractAddress,
  }));

  // Call the Relayer to perform user-side decryption
  return await instance.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature,
    [contractAddress],
    signerAddress,
    startTimeStamp,
    durationDays
  );
}
