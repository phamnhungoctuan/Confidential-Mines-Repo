## Game Flow

```mermaid
flowchart TD
    A[Player Starts Game] --> B[Encrypt Board<br/>Pack bits + FHEVM]
    B --> C[Contract: createGame<br/>Store ciphertext + commits]
    C --> D[Player Picks Tiles<br/>pickTile(index)]
    D --> E[Contract: Extract Encrypted Bit]
    E --> F[Encrypted Result<br/>(safe/bomb)]
    F --> G[Gameplay Continues]
    G -->|Bomb or Cashout| H[endGame()]
    H --> I[revealSeed()]
    I --> J[Verifier Decrypts Ciphertext]
    J --> K[Compare Commit]
    K --> L[✅ Provably Fair]
```

---

## Encrypt Flow

```mermaid
sequenceDiagram
    participant U as User (Frontend)
    participant W as Web Worker
    participant C as Contract

    U->>W: Pack board → uint64 bitmask
    W->>W: Encrypt with FHEVM SDK<br/>(createEncryptedInput)
    W->>U: Return ciphertext + proof
    U->>C: createGame(encryptedBoard, proof,<br/>commitHash, ciphertextCommit, boardSize)
    C->>C: Store encryptedBoard, commitHash,<br/>ciphertextCommit
```

---

## Decrypt & Verify Flow

```mermaid
sequenceDiagram
    participant P as Player
    participant C as Contract
    participant V as Verifier

    P->>C: endGame(gameId)
    P->>C: revealSeed(gameId, seed)
    C->>C: Recompute keccak(seed, player, boardSize)
    C->>P: ✅ Seed commit verified
    P->>C: allowVerifier(gameId, V)
    C->>V: Verifier allowed to decrypt
    V->>C: Fetch encryptedBoard + metadata
    V->>V: Decrypt ciphertext, rebuild board
    V->>V: Compare commitHash & ciphertextCommit
    V->>P: ✅ or ❌ Verification result
```

---

## FHEVM Workflow

```mermaid
flowchart LR
    A[Plaintext Board<br/>uint64 bitmask] --> B[Encrypt via SDK<br/>euint64 ciphertext]
    B --> C[Smart Contract<br/>stores ciphertext + commit]
    C --> D[On-chain Computation<br/>pickTile AND mask]
    D --> E[Encrypted Result<br/>ebool isBomb]
    E --> F[Decrypt off-chain<br/>by player/verifier]
    F --> G[Reveal + Verify<br/>commitHash & ciphertextCommit]
    G --> H[✅ Provably Fair Game]
```

---

**Explanation:**

1. **Encrypt** — Player packs board → encrypts as `euint64`.
2. **Store** — Contract saves ciphertext + commitments.
3. **Compute** — Contract extracts bits with homomorphic ops.
4. **Decrypt** — Player/verifier decrypts result after end.
5. **Verify** — Check seed + ciphertextCommit → fairness guaranteed.