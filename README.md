# 🎮 Confidential Mines

A **provably fair blockchain game** built on [Zama's FHEVM](https://zama.ai), where encryption meets on-chain gaming.
Players enjoy a **Minesweeper-inspired challenge** while knowing every move is **private, secure, and verifiable**.

<p align="center">
  <img src="./mines.png" alt="Game Flow" width="250"/>
</p>

---

## ✨ Features

* 🕹 **Minesweeper gameplay** — pick safe tiles, avoid bombs.
* 🔐 **Privacy by design** — boards are encrypted with **Fully Homomorphic Encryption (FHE)**.
* ✅ **Provably fair** — seeds + commitments guarantee integrity.
* 🌐 **Decentralized** — runs fully on Ethereum Sepolia testnet.
* 🦊 **MetaMask integration** — connect and play instantly.

---

## 🌐 Demo

* 🎮 **Play** → [confidential-mines.vercel.app](https://confidential-mines.vercel.app/)
* 🔎 **Verify** → [confidential-mines-verify.vercel.app/api/verify](https://confidential-mines-verify.vercel.app/api/verify)
* **Contract (Sepolia)** → [0x3115579c839E357032dA49C4B3Bc33127eca474f](https://sepolia.etherscan.io/address/0x3115579c839E357032dA49C4B3Bc33127eca474f)

---

## 🔑 Game Flow

See [GAME-FLOW.md](./GAME-FLOW.md) for:

- Game flow
- Encrypt Flow
- Decrypt & Verify Flow

### 1. Encrypted Board

* The board (bombs/safe tiles) is packed into a **uint64 bitmask**.
* Each bit = one tile (0 = safe, 1 = bomb).
* Entire board ≤ 64 tiles (Confidential Mines uses \~30–40).
* Bitmask is encrypted into a single `euint64` ciphertext.

### 2. On-chain Commitment

When creating a game, the contract stores:

* `encryptedBoard` (`euint64`)
* `commitHash = keccak256(seed, player, boardSize)`
* `ciphertextCommit` (commitment over raw ciphertext bytes)

```solidity
function createGame(
  externalEuint64 encryptedPackedBoard,
  bytes calldata proof,
  bytes32 commitHash,
  bytes32 ciphertextCommit,
  uint8 boardSize
) external returns (uint256 gameId);
```

## 🔐 Why FHE Matters

Without FHE:

* Developers must run logic off-chain → players must trust them.
* RNG can be weak/bias → outcomes unverifiable.

With **Zama’s FHEVM**:

* Boards are encrypted and stored on-chain.
* No one (not even miners) can peek at bomb locations.
* Commitments + seed reveal guarantee **provable fairness**.
* Verifiers can audit via `allowVerifier`.

---



## 📡 Verify API

### Endpoint

```
POST https://confidential-mines-verify.vercel.app/api/verify
```

### Request Body

```json
{
  "gameId": 1
}
```

### Example Response

```json
{
  "ciphertexts": [
    "0x04c0...deadbeef"   // bit-packed ciphertext
  ],
  "contractAddress": "0x3115579c839E357032dA49C4B3Bc33127eca474f",
  "player": "0x1234abcd...ef",
  "boardSize": 36,
  "commitHash": "0x456...",
  "ciphertextCommit": "0x789...",
  "openedCount": 2,
  "openedBitmap": "3",
  "state": 1
}
```

### Fields

* **ciphertexts** → array with the single encrypted board (`euint64`).
* **boardSize** → number of tiles (≤ 64).
* **commitHash** → keccak256(seed, player, boardSize).
* **ciphertextCommit** → commitment for raw ciphertext bytes.
* **openedBitmap** → tracks opened tiles.
* **state** → 0 = Active, 1 = Ended.

### Verification Flow

1. Frontend calls `/verify` with `gameId`.
2. API returns ciphertext + metadata.
3. Off-chain verifier decrypts ciphertext.
4. Commit is recomputed and compared.
5. If match → ✅ provably fair, else → ❌ mismatch.

---

## 🚀 Getting Started

### 1. Install

```bash
npm install
```

### 2. Set environment

```bash
npx hardhat vars set PRIVATE_KEY
```

### 3. Compile + Test

```bash
npx hardhat clean && npx hardhat compile
npx hardhat test
```

### 4. Deploy

```bash
# Local FHEVM-ready node
npx hardhat node

# Deploy
npx hardhat deploy --network localhost
```

### 5. Play on Sepolia

```bash
npx hardhat deploy --network sepolia
```

---

## 🛠 Tech Stack

* **Contracts**: Solidity + Hardhat
* **Frontend**: React + TypeScript + Ethers.js
* **Encryption**: [FHEVM](https://docs.zama.ai/fhevm)
* **Wallet**: MetaMask
* **Network**: Sepolia

---

## 📚 Documentation

* [FHEVM Docs](https://docs.zama.ai/fhevm)
* [Solidity Guides](https://docs.zama.ai/protocol/solidity-guides/getting-started/setup)
* [Zama Discord](https://discord.gg/zama)

---

## 🌟 Credits

Built with ❤️ using **[Zama’s FHEVM](https://zama.ai)**.
Confidential Mines shows the future of Web3 gaming: **privacy, fairness, decentralization** together.

---

## Contact

* GitHub → [phamnhungoctuan](https://github.com/phamnhungoctuan)
* Twitter → [@tuanphamit](https://x.com/tuanphamit)
