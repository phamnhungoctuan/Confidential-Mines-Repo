import { ethers } from "ethers";
import ConfidentialMinesAbi from "../abi/ConfidentialMines.json";

const CONTRACT_ADDRESS = "0x3b1E64A5cFBB3ad594eB4A79502D609cEe71B244";

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

async function getContract() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ConfidentialMinesAbi.abi, signer);
}

async function encryptBoardInWorker(board: number[], contract: string, user: string) {
  return new Promise<{ encryptedTiles: string[]; inputProof: string }>((resolve, reject) => {
    const worker = new Worker("/encryptWorker.js", { type: "classic" });

    worker.onmessage = (e) => {
      if (e.data.error) reject(e.data.error);
      else resolve(e.data);
      worker.terminate();
    };

    worker.postMessage({
      board,
      contractAddress: contract,
      userAddress: user,
      sdkConfig,
    });
  });
}

export async function createGame(board: number[], seed: number) {
  console.log("🟢 createGame...");
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const signerAddr = await signer.getAddress();
  const contract = await getContract();

  console.time("encryptBoard (worker)");
  const { encryptedTiles, inputProof } = await encryptBoardInWorker(board, CONTRACT_ADDRESS, signerAddr);
  console.timeEnd("encryptBoard (worker)");

  const commitHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "address", "uint8"], [seed, signerAddr, board.length]),
  );

  const tx = await contract.createGame(encryptedTiles, inputProof, commitHash, board.length);
  return tx;
}

export function pickTileLocal(board: number[], index: number, state: { safeCount: number; multiplier: number }) {
  const tile = board[index];
  if (tile === 1) {
    console.log("BOOM!");
    return { ...state, boom: true };
  }
  const newSafeCount = state.safeCount + 1;
  const newMultiplier = Math.floor(state.multiplier * 1.05); // +5%
  console.log(`✅ SAFE! safeCount=${newSafeCount}, multiplier=${newMultiplier}`);
  return { safeCount: newSafeCount, multiplier: newMultiplier, boom: false };
}

export async function cashOut(gameId: number) {
  console.log("💰 cashOut");
  const contract = await getContract();
  const tx = await contract.cashOut(gameId);
  await tx.wait();
}

export async function revealGame(gameId: number, board: number[]) {
  console.log("📜 revealGame");
  const contract = await getContract();
  const tx = await contract.revealGame(gameId, board);
  await tx.wait();
  console.log("✅ revealGame done");
}

/** 🔑 Reveal seed for provably-fair check */
export async function revealSeed(gameId: number, seed: number) {
  console.log("🔑 revealSeed");
  const contract = await getContract();
  const tx = await contract.revealSeed(gameId, seed);
  await tx.wait();
  console.log("✅ revealSeed done");
}
