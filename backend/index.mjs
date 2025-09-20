import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import ConfidentialMinesAbi from "./ConfidentialMines.json" with { type: "json" };

const app = express();
app.use(cors());
app.use(express.json());

const CONTRACT_ADDRESS = "0x3b1E64A5cFBB3ad594eB4A79502D609cEe71B244";
const RPC_URL = "https://eth-sepolia.public.blastapi.io";

// Route verify
app.post("/verify", async (req, res) => {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // --- Handle preflight request ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const { gameId, proofJson } = req.body;
    if (!proofJson) {
      return res.status(400).send("Missing proofJson");
    }

    const { seed, player, boardSize } = proofJson;

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ConfidentialMinesAbi.abi, provider);

    const game = await contract.games(gameId);
    const onChainCommit = game.commitHash;

    const computedCommit = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "address", "uint8"], [seed, player, boardSize]),
    );

    const isValid = onChainCommit.toLowerCase() === computedCommit.toLowerCase();

    res.send(`
      <html>
      <head>
        <title>Verify Game #${gameId}</title>
        <style>
          body { font-family: Arial; padding: 20px; background: #111; color: #eee; }
          .ok { color: #2ecc71; font-weight: bold; }
          .fail { color: #e74c3c; font-weight: bold; }
          .box { padding: 12px; border: 1px solid #444; margin: 8px 0; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>🔎 Verify Game #${gameId}</h1>
        <div class="box"><b>Player:</b> ${player}</div>
        <div class="box"><b>Seed:</b> ${seed}</div>
        <div class="box"><b>Board Size:</b> ${boardSize}</div>
        <div class="box"><b>On-chain Commit:</b> ${onChainCommit}</div>
        <div class="box"><b>Computed Commit:</b> ${computedCommit}</div>
        <h2 class="${isValid ? "ok" : "fail"}">
          ${isValid ? "✅ Verification Successful! The game was provably fair." : "❌ Verification Failed! Commit mismatch."}
        </h2>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).send("Server error: " + err.message);
  }
});

app.listen(3001, () => {
  console.log("✅ Verify server running at http://localhost:3001");
});
