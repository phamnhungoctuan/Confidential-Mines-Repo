import { ethers } from "ethers";
import { getRelayerInstance, buildEIP712, decryptBoard } from "./relayer";
import ConfidentialBombAbi from "../abi/ConfidentialMines.json";
import type { Provider } from "@reown/appkit/react";

// Helper: fetch ciphertext + board size from contract
export async function fetchCiphertext(gameId: number) {
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS as string;
  const rpcUrl = import.meta.env.VITE_RPC_URL || "https://eth-sepolia.public.blastapi.io";

  if (!contractAddress) throw new Error("Missing VITE_CONTRACT_ADDRESS in .env");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ConfidentialBombAbi.abi, provider);

  // contract.games is a public mapping getter
  const g = await contract.games(gameId);
  const encryptedBoard = g.encryptedBoard ?? g[2];
  const boardSize = g.boardSize ? Number(g.boardSize) : null;

  if (!encryptedBoard) throw new Error("No ciphertext found for this game");

  return { ciphertexts: [encryptedBoard], contractAddress, boardSize };
}

// Handles the "Verify Fairness" button click
export async function handleVerifyClick(
  walletProvider: Provider,
  gameId: number,
  setShowVerifyModal: any,
  setStatusMsg: any,
  setVerifyError: any,
  setCiphertextMatch: any,
  verifyGame: any,
) {
  try {
    setVerifyError(null);
    setCiphertextMatch(null);
    setStatusMsg("Preparing verification...");

    // 🔹 Fetch ciphertext trực tiếp từ contract
    const { ciphertexts, contractAddress, boardSize } = await fetchCiphertext(gameId);

    // 🔹 Init relayer
    setStatusMsg("Initializing relayer for decryption...");
    const instance = await getRelayerInstance();
    const keypair = instance.generateKeypair();
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10";

    // 🔹 Build EIP712 & sign
    setStatusMsg("Waiting for wallet signature...");
    const provider = new ethers.BrowserProvider(walletProvider as any);
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    const eip712 = buildEIP712(instance, keypair.publicKey, [contractAddress], startTimeStamp, durationDays);
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );

    setShowVerifyModal(true);

    await verifyGame({
      ciphertexts,
      contractAddress,
      boardSize,
      instance,
      keypair,
      signature,
      signerAddress,
      startTimeStamp,
      durationDays,
    });
  } catch (err: any) {
    console.error("handleVerifyClick error:", err);
    setVerifyError(err?.message || String(err));
    setStatusMsg("❌ Prepare/sign failed: " + (err?.message || String(err)));
  }
}

// Performs the actual verification
export async function verifyGame(
  prepared: any,
  setDecryptedFlatBoard: any,
  setDecryptedRows: any,
  setStatusMsg: any,
  setVerifyError: any,
  setVerifying: any,
  board: number[][]
) {
  setVerifying(true);
  setVerifyError(null);
  setDecryptedFlatBoard(null);
  setDecryptedRows(null);

  try {
    const {
      ciphertexts,
      contractAddress,
      boardSize,
      instance,
      keypair,
      signature,
      signerAddress,
      startTimeStamp,
      durationDays,
    } = prepared;

    setStatusMsg("Requesting decryption from Relayer...");
    const results = await decryptBoard(
      ciphertexts,
      contractAddress,
      instance,
      keypair,
      signature,
      signerAddress,
      startTimeStamp,
      durationDays
    );

    const raw = results[ciphertexts[0]];
    if (!raw) throw new Error("Relayer returned no plaintext for the ciphertext");

    const plaintextBigInt = BigInt(typeof raw === "object" && raw.plaintext ? raw.plaintext : raw);

    // unpack bits into array
    const unpackLSB = (value: bigint, len: number): number[] =>
      Array.from({ length: len }, (_, i) => ((value >> BigInt(i)) & 1n) === 1n ? 1 : 0);

    const flat = unpackLSB(plaintextBigInt, boardSize ?? board.flat().length);
    setDecryptedFlatBoard(flat);

    // rebuild rows
    const rows: number[][] = [];
    let cursor = 0;
    for (let r = 0; r < board.length; r++) {
      rows.push(flat.slice(cursor, cursor + board[r].length));
      cursor += board[r].length;
    }
    setDecryptedRows(rows.slice().reverse());

    setStatusMsg("✅ Decryption successful");
  } catch (err: any) {
    console.error("Verify error:", err);
    setVerifyError(err?.message || String(err));
    setStatusMsg("❌ Verification failed: " + (err?.message || String(err)));
  } finally {
    setVerifying(false);
  }
}
