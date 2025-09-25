# 🎮 Confidential Mines

A **provably fair blockchain game** built on [Zama's FHEVM](https://zama.ai), where encryption meets on-chain gaming.
Players enjoy a **Minesweeper-inspired challenge** while knowing every move is **private, secure, and verifiable**.

<p align="center">
  <img src="./mines.png" alt="Game Flow" width="250"/>
</p>

---

## ✨ Features

* **Minesweeper gameplay** — pick safe tiles, avoid bombs.
* **Privacy by design** — boards are encrypted with **Fully Homomorphic Encryption (FHE)**.
* **Provably fair** — seeds + commitments guarantee integrity.

---

## 🌐 Demo

* 🎮 **Play** → [confidential-mines.vercel.app](https://confidential-mines.vercel.app/)
* **Contract (Sepolia)** → [0x3115579c839E357032dA49C4B3Bc33127eca474f](https://sepolia.etherscan.io/address/0x3115579c839E357032dA49C4B3Bc33127eca474f)

---

## 🔑 Game Flow

See [GAME-FLOW.md](./GAME-FLOW.md) for:

* Game flow
* Encrypt Flow
* Decrypt & Verify Flow

### 1. Encrypted Board

* The board (bombs/safe tiles) is packed into a **uint64 bitmask**.
* Each bit = one tile (0 = safe, 1 = bomb).
* Entire board ≤ 64 tiles (Confidential Mines uses ~30–40).
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

---

## 🔐 Why FHE Matters

Without FHE:

* Developers must run logic off-chain → players must trust them.
* RNG can be weak/bias → outcomes unverifiable.

With **Zama’s FHEVM**:

* Boards are encrypted and stored on-chain.
* No one (not even miners) can peek at bomb locations.
* Commitments + seed reveal guarantee **provable fairness**.
* Verifiers can audit directly on-chain.

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

## Gameplay Enhancements

* **Bet & Cashout** — allow players to choose an initial stake and cash out based on the multiplier.
* **Reputation & Leaderboards** — maintain transparent leaderboards based on multipliers, while keeping player identities private.
* **Game Info by ID** — allow anyone to fetch game state directly from the contract using only the `gameId`.

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
