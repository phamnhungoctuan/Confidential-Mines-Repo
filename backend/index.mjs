// backend/index.mjs
import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import dotenv from "dotenv";
import ConfidentialMinesAbi from "./ConfidentialMines.json" with { type: "json" };

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const RPC_URL = process.env.RPC_URL || "";
const PORT = process.env.PORT || 3001;

if (!CONTRACT_ADDRESS || !RPC_URL) {
  throw new Error("Missing CONTRACT_ADDRESS or RPC_URL in .env");
}

function convertBigInt(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(convertBigInt);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      try {
        out[k] = convertBigInt(value[k]);
      } catch (e) {
        // fallback: toString
        out[k] = String(value[k]);
      }
    }
    return out;
  }
  return value;
}

/// Endpoint to verify and fetch the encrypted board from the smart contract
app.post("/verify", async (req, res) => {
  try {
    const { gameId } = req.body;
    if (gameId === undefined || gameId === null) return res.status(400).send("Missing gameId");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ConfidentialMinesAbi.abi, provider);

    // Try to read the public `games` mapping getter
    let g;
    try {
      g = await contract.games(gameId);
    } catch (e) {
      console.error("[/verify] failed to call games(gameId):", e);
      return res.status(500).send("Contract does not expose games(gameId) or call failed. Check ABI/deployment.");
    }

    // Defensive extraction: mapping getter returns a tuple-like object; try name keys then index keys.
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
    console.log("[/verify] ciphertext handle:", encryptedBoard);
    console.log("[/verify] ciphertextCommit (onchain):", ciphertextCommit);
    console.log("[/verify] commitHash (onchain):", commitHash);

    if (!encryptedBoard) {
      return res.status(400).send("No ciphertext found for this game");
    }

    // Return the ciphertext(s) and metadata to the frontend verifier
        // Build payload with metadata. Convert any BigInt nested inside before send.
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
});

app.listen(PORT, () => {
  console.log(`Verify server running on http://localhost:${PORT}`);
});
