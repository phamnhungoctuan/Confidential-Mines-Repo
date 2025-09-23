// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { FHE, euint64, ebool, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialMines (Bit-Packed)
/// @notice Minesweeper-like game using a single encrypted ciphertext for the whole board.
/// @dev Each tile is 1 bit (0 = safe, 1 = bomb), packed into a uint64, then encrypted as euint64.
///      This dramatically reduces storage and gas vs. an encrypted array of tiles.
///      Board size must be <= 64. Designed for 30–40 tiles.
contract ConfidentialMines is SepoliaConfig {
    // --------- States ----------
    enum State {
        Active,   // Game ongoing
        Ended     // Game finished (by cashout or boom, decided off-chain)
    }

    // --------- Game model ----------
    struct Game {
        address player;            // Owner of this game instance
        uint8 boardSize;           // Number of tiles (<= 64)
        euint64 encryptedBoard;    // Bit-packed board: LSB is index 0
        bytes32 commitHash;        // keccak256(seed, player, boardSize)
        bytes32 ciphertextCommit;  // Commitment over raw ciphertext bytes (Merkle root or keccak)
        uint32 openedCount;        // How many tiles opened (non-sensitive UX counter)
        uint64 openedBitmap;       // Plain bitmap of opened tiles to prevent double-open
        State state;               // Current state
    }

    // --------- Storage ----------
    uint256 public gameCounter;
    mapping(uint256 => Game) public games;

    // --------- Events ----------
    event GameCreated(
        uint256 indexed gameId,
        address indexed player,
        uint8 boardSize,
        bytes32 commitHash,
        bytes32 ciphertextCommit
    );

    /// @dev `isBomb` is encrypted (ebool). No plaintext leakage on-chain.
    event TilePicked(
        uint256 indexed gameId,
        uint256 index,
        ebool isBomb,
        uint32 openedCount
    );

    event GameEnded(uint256 indexed gameId, State state);
    event SeedRevealed(uint256 indexed gameId, uint256 seed);
    event VerifierAllowed(uint256 indexed gameId, address verifier);

    // ------------------------------------------------------------------------
    // 🟢 Creation
    // ------------------------------------------------------------------------
    /// @notice Create a new game with a single encrypted ciphertext for the board.
    /// @param encryptedPackedBoard External handle of the packed board ciphertext (uint64).
    /// @param proof Batch input proof for FHE import.
    /// @param commitHash keccak256(seed, msg.sender, boardSize).
    /// @param ciphertextCommit Commitment (e.g., keccak or Merkle root) over raw ciphertext bytes at creation time.
    /// @param boardSize Number of tiles (<= 64).
    /// @return gameId Newly created game ID.
    function createGame(
        externalEuint64 encryptedPackedBoard,
        bytes calldata proof,
        bytes32 commitHash,
        bytes32 ciphertextCommit,
        uint8 boardSize
    ) external returns (uint256 gameId) {
        require(boardSize > 0 && boardSize <= 64, "Invalid board size");
        require(commitHash != bytes32(0), "Empty commit");
        require(ciphertextCommit != bytes32(0), "Empty ciphertextCommit");

        euint64 packed = FHE.fromExternal(encryptedPackedBoard, proof);
        // Allow the contract to compute on the ciphertext
        FHE.allowThis(packed);
        // Allow the player to decrypt results derived from this ciphertext if needed
        FHE.allow(packed, msg.sender);

        gameId = ++gameCounter;
        games[gameId] = Game({
            player: msg.sender,
            boardSize: boardSize,
            encryptedBoard: packed,
            commitHash: commitHash,
            ciphertextCommit: ciphertextCommit,
            openedCount: 0,
            openedBitmap: 0,
            state: State.Active
        });

        emit GameCreated(gameId, msg.sender, boardSize, commitHash, ciphertextCommit);
    }

    // ------------------------------------------------------------------------
    // 🎮 Gameplay (bit extraction over euint64)
    // ------------------------------------------------------------------------
    /// @notice Pick a tile by index and emit encrypted result (safe/bomb).
    /// @dev Extracts a single bit from the packed ciphertext using a plaintext mask.
    ///      Prevents double-pick via plaintext bitmap (does not leak where the bombs are).
    function pickTile(uint256 gameId, uint256 index) external {
        Game storage g = games[gameId];
        require(g.state == State.Active, "Not active");
        require(msg.sender == g.player, "Not your game");
        require(index < g.boardSize, "Index out of range");

        // Prevent double-opening the same tile (tracked in plaintext)
        uint64 bit = uint64(1) << uint64(index);
        require((g.openedBitmap & bit) == 0, "Already opened");
        g.openedBitmap |= bit;

        // isBomb = ((encryptedBoard & (1 << index)) != 0)
        // Build plaintext mask as uint64, lift to euint64, AND, then compare to zero.
        euint64 mask = FHE.asEuint64(uint64(1) << uint64(index));
        euint64 extracted = FHE.and(g.encryptedBoard, mask);
        ebool isBomb = FHE.not(FHE.eq(extracted, FHE.asEuint64(0)));

        g.openedCount += 1;

        emit TilePicked(gameId, index, isBomb, g.openedCount);
    }

    /// @notice End the game (cashout or boom decided off-chain after decryption).
    /// @dev Frontend/backends call this once outcome is known off-chain (no plaintext on-chain).
    function endGame(uint256 gameId) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.Active, "Already ended");

        g.state = State.Ended;
        emit GameEnded(gameId, g.state);
    }

    // ------------------------------------------------------------------------
    // 🔍 Provably-fair: commit reveal + ciphertext audit at the end
    // ------------------------------------------------------------------------
    /// @notice Reveal original seed to check commit integrity.
    /// @dev Contract recomputes keccak256(seed, player, boardSize).
    function revealSeed(uint256 gameId, uint256 seed) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.Ended, "Reveal after end");

        bytes32 expected = keccak256(abi.encode(seed, g.player, g.boardSize));
        require(expected == g.commitHash, "Commit mismatch");

        emit SeedRevealed(gameId, seed);
    }

    /// @notice Allow an external verifier to decrypt the packed board after the game ends.
    /// @dev This enables a ciphertext-based audit without exposing data mid-game.
    function allowVerifier(uint256 gameId, address verifier) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.Ended, "Allow after end");
        require(verifier != address(0), "Zero verifier");

        FHE.allow(g.encryptedBoard, verifier);
        emit VerifierAllowed(gameId, verifier);
    }

    // ------------------------------------------------------------------------
    // 👀 Views
    // ------------------------------------------------------------------------
    function getBoardSize(uint256 gameId) external view returns (uint8) {
        return games[gameId].boardSize;
    }

    function getState(uint256 gameId) external view returns (State) {
        return games[gameId].state;
    }

    function getCommit(uint256 gameId) external view returns (bytes32) {
        return games[gameId].commitHash;
    }

    function getCiphertextCommit(uint256 gameId) external view returns (bytes32) {
        return games[gameId].ciphertextCommit;
    }

    function getOpenedCount(uint256 gameId) external view returns (uint32) {
        return games[gameId].openedCount;
    }

    function getOpenedBitmap(uint256 gameId) external view returns (uint64) {
        return games[gameId].openedBitmap;
    }
}
