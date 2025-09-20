# 🎮 Confidential Mines

A **provably fair** blockchain game built on top of [Zama's FHEVM](https://zama.ai), where encryption meets on-chain
gaming.  
Players can enjoy a fun **Minesweeper-inspired** game while trusting that every outcome is **secure, private, and
verifiable**.

---

## ✨ Features

- 🕹 **Minesweeper-style gameplay** — pick safe tiles, avoid bombs, climb to the top.
- 🔐 **Privacy by design** — game boards are encrypted using **Fully Homomorphic Encryption (FHE)**.
- ✅ **Provably fair** — players can independently verify that each game was created honestly.
- 🌐 **Decentralized** — runs on Ethereum Sepolia testnet, powered by smart contracts.
- 🦊 **MetaMask integration** — connect your wallet and start playing instantly.

---

## 🔒 Security & Provably-Fair Mechanism

Unlike traditional Web3 games where servers can manipulate outcomes, **Confidential Mines** leverages **Zama’s FHEVM**:

1. **Encrypted Game State**
   - The board (safe tiles + bombs) is encrypted using **FHE** before deployment.
   - Even the blockchain and miners cannot see the contents.

2. **On-chain Commitment**
   - When a player starts a game, the encrypted board is **committed on-chain**.
   - This ensures no one (not even the developer) can alter the board after creation.

3. **Provably Fair Verification**
   - At the end of the game (win or lose), a proof JSON is generated.
   - Anyone can open the **Verify Server** to check that the revealed board matches the original encrypted commitment.

This makes the game **100% transparent** while keeping gameplay **private and fun**.

---

## 🔑 Encryption via Worker

The encryption process is computationally heavy. To avoid blocking the UI, the board is encrypted inside a **Web
Worker** that loads the FHEVM SDK:

```js
/* eslint-disable no-undef */
importScripts("/fhevm-worker.js");

let fhevm = null;

self.onmessage = async (e) => {
  const { board, contractAddress, userAddress, sdkConfig } = e.data;

  try {
    const PossibleSDK = self.RelayerSDK || self.relayerSDK || self.fhevm || self.FHE || self.Zama;
    if (!PossibleSDK) throw new Error("FHE SDK global not found");

    if (!fhevm) {
      let instanceCreator;
      if (typeof PossibleSDK === "function") {
        const maybeNeedsInit = new PossibleSDK();
        if (typeof maybeNeedsInit.initSDK === "function") {
          await maybeNeedsInit.initSDK();
        }
        instanceCreator = maybeNeedsInit;
      } else {
        instanceCreator = PossibleSDK;
        if (typeof instanceCreator.initSDK === "function") {
          await instanceCreator.initSDK();
        }
      }
      fhevm = await instanceCreator.createInstance(sdkConfig);
    }

    const buf = fhevm.createEncryptedInput(contractAddress, userAddress);
    board.forEach((v) => buf.add32(BigInt(v)));
    const result = await buf.encrypt();

    self.postMessage({
      encryptedTiles: result.handles,
      inputProof: result.inputProof,
    });
  } catch (err) {
    self.postMessage({ error: err?.message || String(err) });
  }
};
```

This ensures:

- 🔄 **Non-blocking UI** — players can still interact with the game while encryption runs in background.
- ⚡ **Optimized performance** — heavy FHE operations are isolated from the main thread.
- 🔐 **Secure commitments** — encrypted inputs + inputProof are generated before submitting to the smart contract.

---

## 🌐 Demo

- 🎮 **Play the Game**: [confidential-mines.vercel.app](https://confidential-mines.vercel.app/)
- 🔎 **Verify Proofs**:
  [confidential-mines-verify.vercel.app/api/verify](https://confidential-mines-verify.vercel.app/api/verify)

---

## 📡 Verify API

### Endpoint

```
POST https://confidential-mines-verify.vercel.app/api/verify
```

### Example Payload

```json
{
  "gameId": 1,
  "proofJson": {
    "board": [0, 1, 0, 0, 1, 0],
    "seed": 123456,
    "player": "0x1234...abcd",
    "boardSize": 6
  }
}
```

### Example Response

```html
<h2>✅ Verification Passed</h2>
<p>The decrypted board matches the committed on-chain state. The game is provably fair.</p>
```

If verification fails:

```html
<h2>❌ Verification Failed</h2>
<p>The provided proof does not match the on-chain commitment.</p>
```

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run locally

```bash
npm run dev
```

### 3. Deploy contracts

```bash
# Local FHEVM-ready node
npx hardhat node

# Deploy contracts
npx hardhat deploy --network localhost
```

### 4. Play on Sepolia

```bash
npx hardhat deploy --network sepolia
```

Once deployed, connect MetaMask to **Sepolia Testnet** and start playing 🎉

---

## 🛠 Tech Stack

- **Smart Contracts**: Solidity + Hardhat
- **Frontend**: React + TypeScript + Ethers.js
- **Encryption**: [FHEVM](https://docs.zama.ai/fhevm) by Zama
- **Wallet**: MetaMask
- **Network**: Sepolia Testnet

---

## 📚 Documentation

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [FHEVM Solidity Guides](https://docs.zama.ai/protocol/solidity-guides/getting-started/setup)
- [Zama Discord Community](https://discord.gg/zama)

---

## 🌟 Credits

Built with ❤️ using **[Zama’s FHEVM](https://zama.ai)** — bringing **privacy-preserving smart contracts** to Ethereum.

> Confidential Mines is more than just a game — it’s a **demonstration of the future of Web3 gaming**, where **privacy,
> fairness, and decentralization** coexist.

---

## 🐙 GitHub

[Visit Developer’s GitHub](https://github.com/phamnhungoctuan)
