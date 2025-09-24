import { ethers } from "ethers";
import ConfidentialMinesAbi from "../abi/ConfidentialMines.json";
import type { Provider } from "@reown/appkit/react";

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;

if (!CONTRACT_ADDRESS) {
  throw new Error("⚠️ Missing VITE_CONTRACT_ADDRESS in .env file");
} else {
  console.log(`✅ Using contract address: ${CONTRACT_ADDRESS}`);
}

const sdkConfig = {
  aclContractAddress: "0x687820221192C5B662b25367F70076A37bc79b6c",
  kmsContractAddress: "0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC",
  inputVerifierContractAddress: "0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4",
  verifyingContractAddressDecryption: "0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1",
  verifyingContractAddressInputVerification: "0x7048C39f048125eDa9d678AEbaDfB22F7900a29F",
  chainId: 11155111,
  gatewayChainId: 55815,
  network: "https://eth-sepolia.public.blastapi.io",
  relayerUrl: "https://relayer.testnet.zama.cloud",
};

/**
 * Get contract instance with AppKit provider
 */
export async function getContract(walletProvider: Provider) {
  const provider = new ethers.BrowserProvider(walletProvider as any);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ConfidentialMinesAbi.abi, signer);
}

/**
 * Pack board (array of 0/1) into a uint64 bitmask.
 * index 0 = least significant bit.
 */
function packBoard(board: number[]): bigint {
  if (board.length > 64) throw new Error("Board too big for uint64");
  let packed = 0n;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 1) {
      packed |= 1n << BigInt(i);
    }
  }
  return packed;
}

/**
 * Encrypt packed board in worker.
 */
async function encryptBoardInWorker(
  packedBoard: bigint,
  contract: string,
  user: string
) {
  return new Promise<{ encryptedBoard: string; inputProof: string }>(
    (resolve, reject) => {
      const worker = new Worker("/encryptWorker.js", { type: "classic" });

      worker.onmessage = (e) => {
        if (e.data.error) reject(e.data.error);
        else resolve(e.data);
        worker.terminate();
      };

      worker.postMessage({
        packedBoard: packedBoard.toString(),
        contractAddress: contract,
        userAddress: user,
        sdkConfig,
      });
    }
  );
}

/** Create game */
export async function createGame(
  walletProvider: Provider,
  board: number[],
  seed: number
) {
  console.log("🟢 createGame...");

  const provider = new ethers.BrowserProvider(walletProvider as any);
  const signer = await provider.getSigner();
  const signerAddr = await signer.getAddress();
  const contract = await getContract(walletProvider);

  // Pack board
  const packed = packBoard(board);

  console.time("encryptBoard (worker)");
  const { encryptedBoard, inputProof } = await encryptBoardInWorker(
    packed,
    CONTRACT_ADDRESS,
    signerAddr
  );
  console.timeEnd("encryptBoard (worker)");

  const commitHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "uint8"],
      [seed, signerAddr, board.length]
    )
  );

  const ciphertextCommit = ethers.keccak256(encryptedBoard);

  const tx = await contract.createGame(
    encryptedBoard,
    inputProof,
    commitHash,
    ciphertextCommit,
    board.length
  );
  return tx;
}

/** Local simulation for testing pickTile logic */
export function pickTileLocal(
  board: number[],
  index: number,
  state: { safeCount: number; multiplier: number }
) {
  const tile = board[index];
  if (tile === 1) {
    console.log("💥 BOOM!");
    return { ...state, boom: true };
  }
  const newSafeCount = state.safeCount + 1;
  const newMultiplier = Math.floor(state.multiplier * 1.05);
  console.log(`✅ SAFE! safeCount=${newSafeCount}, multiplier=${newMultiplier}`);
  return { safeCount: newSafeCount, multiplier: newMultiplier, boom: false };
}

export async function endGame(walletProvider: Provider, gameId: number) {
  console.log("endGame");
  const contract = await getContract(walletProvider);
  const tx = await contract.endGame(gameId);
  await tx.wait();
  console.log("endGame done");
}

export async function revealSeed(walletProvider: Provider, gameId: number, seed: number) {
  console.log("revealSeed");
  const contract = await getContract(walletProvider);
  const tx = await contract.revealSeed(gameId, seed);
  await tx.wait();
}

export async function allowVerifier(walletProvider: Provider, gameId: number, verifier: string) {
  console.log("allowVerifier");
  const contract = await getContract(walletProvider);
  const tx = await contract.allowVerifier(gameId, verifier);
  await tx.wait();
  console.log("verifier allowed");
}
