# 🔍 Confidential Mines Verify

This is the **verification tool** for **Confidential Mines**, built with **Node.js**. It allows anyone to independently
verify that a revealed game board truly matches the encrypted commitment stored onchain.

The verify flow works by:

1. Reading the **proof JSON** (encrypted tiles, input proof, commit hash).
2. Reconstructing the commitment.
3. Checking that the revealed board + seed match the original encrypted commitment.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** (v18+ recommended)
- **npm** or **yarn**

---

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/phamnhungoctuan/Confidential-Mines-Repo
cd backend
npm install
```

Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Update .env with your values:

```bash
CONTRACT_ADDRESS=0xYourContractAddressHere
RPC_URL=https://sepolia.public.blastapi.io
PORT=3001
```

---

## 📂 Proof JSON

Each game generates a proof JSON that looks like this:

```json
{
  "encryptedTiles": ["0xabc...", "0xdef..."],
  "inputProof": "0x123...",
  "commitHash": "0x456...",
  "boardSize": 6,
  "seed": 123456
}
```

- `encryptedTiles` — ciphertext handles stored onchain
- `inputProof` — cryptographic proof that the ciphertext is valid
- `commitHash` — hash binding player, seed, and board size
- `boardSize` — number of tiles in the game
- `seed` — random seed revealed at the end

---

## 📜 Available Commands

```bash
curl -X POST http://localhost:3001/verify \
  -H "Content-Type: application/json" \
  -d '{"gameId":1,"proofJson":{"seed":12345,"player":"0xAbc123...","boardSize":6}}'

```

Runs the verification process for the given `proof.json`.

Example output:

```
🔍 Verifying Confidential Mines proof...
✅ Commit hash matches seed and board size
✅ Encrypted tiles are valid FHE ciphertexts
✅ Board reconstruction successful
🎉 Verification PASSED – game was provably fair
```

---

## 🛠️ Tech Stack

- **Node.js**
- **TypeScript**
- **FHEVM SDK**

---

## 🎯 How It Works

1. **Load proof JSON** from file.
2. **Recompute commit hash** using `(seed, player address, board size)`.
3. **Validate ciphertexts** using the FHEVM SDK.
4. **Compare** the reconstructed board with the onchain commitment.
5. Print `Verification PASSED` or `FAILED`.
