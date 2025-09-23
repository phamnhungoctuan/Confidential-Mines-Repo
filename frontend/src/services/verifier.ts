import { ethers } from "ethers";
import { getRelayerInstance, buildEIP712, decryptBoard } from "./relayer";

const VERIFY_SERVER =
  import.meta.env.VITE_VERIFY_SERVER ||
  "https://confidential-bomb-verify.vercel.app/api/verify";

export async function handleVerifyClick(gameId: number, setShowVerifyModal: any, setStatusMsg: any, setVerifyError: any, setCiphertextMatch: any, verifyGame: any) {
  try {
    setVerifyError(null);
    setCiphertextMatch(null);
    setStatusMsg("Preparing verification...");

    // fetch ciphertexts + contractAddress
    const resp = await fetch(VERIFY_SERVER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Verify server responded ${resp.status}: ${text}`);
    }
    const payload = await resp.json();
    const { ciphertexts, contractAddress, boardSize, ciphertextCommit } = payload;

    // init relayer instance
    setStatusMsg("Initializing relayer for decryption...");
    const instance = await getRelayerInstance();
    const keypair = instance.generateKeypair();
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10";

    // build EIP712 & sign
    setStatusMsg("Waiting for wallet signature...");
    const provider = new ethers.BrowserProvider(window.ethereum as any);
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
      onchainCommit: ciphertextCommit ?? null,
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

export async function verifyGame(prepared: any, setDecryptedFlatBoard: any, setDecryptedRows: any, setStatusMsg: any, setVerifyError: any, setVerifying: any, board: number[][], ROWS: number) {
  setVerifying(true);
  setVerifyError(null);
  setDecryptedFlatBoard(null);
  setDecryptedRows(null);

  try {
    const { ciphertexts, contractAddress, boardSize, instance, keypair, signature, signerAddress, startTimeStamp, durationDays } = prepared;

    setStatusMsg("Requesting decryption from Relayer...");
    const results = await decryptBoard(ciphertexts, contractAddress, instance, keypair, signature, signerAddress, startTimeStamp, durationDays);
    const raw = results[ciphertexts[0]];

    if (!raw) throw new Error("Relayer returned no plaintext for the ciphertext");

    const plaintextBigInt = BigInt(typeof raw === "object" && raw.plaintext ? raw.plaintext : raw);
    const unpackLSB = (value: bigint, len: number): number[] =>
      Array.from({ length: len }, (_, i) => ((value >> BigInt(i)) & 1n) === 1n ? 1 : 0);

    const flat = unpackLSB(plaintextBigInt, Number(boardSize));
    setDecryptedFlatBoard(flat);

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
