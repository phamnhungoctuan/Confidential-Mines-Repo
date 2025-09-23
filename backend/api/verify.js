// api/verify.js
// Vercel serverless function for fetching ciphertexts + metadata from ConfidentialMines contract

import { readFile } from "fs/promises";
import path from "path";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = '0x3115579c839E357032dA49C4B3Bc33127eca474f';
const RPC_URL = "https://eth-sepolia.public.blastapi.io";

async function loadAbi() {
  const p = path.join(process.cwd(), "ConfidentialMines.json");
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw);
}

function convertBigInt(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(convertBigInt);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      try {
        out[k] = convertBigInt(value[k]);
      } catch {
        out[k] = String(value[k]);
      }
    }
    return out;
  }
  return value;
}

export default async function handler(req, res) {
  // --- CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { gameId } = req.body;
    if (gameId === undefined || gameId === null) {
      return res.status(400).send("Missing gameId");
    }

    const ConfidentialMinesAbi = await loadAbi();
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ConfidentialMinesAbi.abi, provider);

    // Gọi public mapping getter games(gameId)
    let g;
    try {
      g = await contract.games(gameId);
    } catch (e) {
      console.error("[/verify] failed to call games(gameId):", e);
      return res.status(500).send("Contract does not expose games(gameId) or call failed. Check ABI/deployment.");
    }

    // Defensive extraction
    const player = g.player ?? g[0];
    const boardSizeRaw = g.boardSize ?? g[1];
    const encryptedBoard = g.encryptedBoard ?? g[2];
    const commitHash = g.commitHash ?? g[3];
    const ciphertextCommit = g.ciphertextCommit ?? g[4];
    const openedCountRaw = g.openedCount ?? g[5];
    const openedBitmap = g.openedBitmap ?? g[6];
    const state = g.state ?? g[7];

    const boardSize = boardSizeRaw !== undefined ? Number(boardSizeRaw) : null;
    const openedCount = openedCountRaw !== undefined ? Number(openedCountRaw) : null;

    console.log("[/verify] gameId:", gameId);
    console.log("[/verify] player:", String(player));
    console.log("[/verify] boardSize:", boardSize);
    console.log("[/verify] encryptedBoard:", encryptedBoard);
    console.log("[/verify] ciphertextCommit:", ciphertextCommit);
    console.log("[/verify] commitHash:", commitHash);

    if (!encryptedBoard) {
      return res.status(400).send("No ciphertext found for this game");
    }

    // Payload trả về cho frontend
    const payload = {
      ciphertexts: [encryptedBoard],
      contractAddress: CONTRACT_ADDRESS,
      player: String(player),
      boardSize,
      commitHash: commitHash ?? null,
      ciphertextCommit: ciphertextCommit ?? null,
      openedCount,
      openedBitmap: openedBitmap ?? null,
      state: state ?? null,
    };

    return res.json(convertBigInt(payload));
  } catch (err) {
    console.error("prepare-decrypt error:", err);
    res.status(500).send("Server error: " + (err?.message || String(err)));
  }
}
