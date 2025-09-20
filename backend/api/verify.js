// api/verify.js
import { readFile } from "fs/promises";
import path from "path";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0x3b1E64A5cFBB3ad594eB4A79502D609cEe71B244";
const RPC_URL = "https://eth-sepolia.public.blastapi.io";

// helper to load ABI
async function loadAbi() {
  const p = path.join(process.cwd(), "ConfidentialMines.json");
  const raw = await readFile(p, "utf8");
  return JSON.parse(raw);
}

// compute keccak
function computeCommit(seed, player, boardSize) {
  if (ethers.AbiCoder) {
    const coder = new ethers.AbiCoder();
    const encoded = coder.encode(["uint256", "address", "uint8"], [seed, player, boardSize]);
    return ethers.keccak256(encoded);
  }
  throw new Error("No AbiCoder in ethers");
}

export default async function handler(req, res) {
  // --- CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const { gameId, proofJson } = req.body; // ✅ Vercel auto parse JSON
    if (!proofJson) return res.status(400).send("Missing proofJson");

    const { seed, player, boardSize } = proofJson;

    const ConfidentialMinesAbi = await loadAbi();

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ConfidentialMinesAbi.abi, provider);

    const game = await contract.games(gameId);
    const onChainCommit = game.commitHash;

    const computedCommit = computeCommit(seed, player, boardSize);
    const isValid = onChainCommit.toLowerCase() === computedCommit.toLowerCase();

    const html = `
      <html>
        <head><title>Verify Game #${gameId}</title></head>
        <body style="background:#111;color:#eee;font-family:sans-serif;padding:20px">
          <h1>🔎 Verify Game #${gameId}</h1>
          <p><b>Player:</b> ${player}</p>
          <p><b>Seed:</b> ${seed}</p>
          <p><b>Board Size:</b> ${boardSize}</p>
          <p><b>On-chain Commit:</b> ${onChainCommit}</p>
          <p><b>Computed Commit:</b> ${computedCommit}</p>
          <h2 style="color:${isValid ? "#2ecc71" : "#e74c3c"}">
            ${isValid ? "✅ Verification Successful" : "❌ Verification Failed"}
          </h2>
        </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html");
    res.status(200).send(html);
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).send("Server error: " + err.message);
  }
}
