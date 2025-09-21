// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, ebool, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialMines
/// @notice Provably-fair Minesweeper game powered by Zama's FHEVM.
/// @dev All sensitive values (board tiles, multiplier) are stored as encrypted FHE types.
///      The contract logic requires FHE ciphertexts to function — ensuring privacy + fairness.
contract ConfidentialMines is SepoliaConfig {
    // --------- Game state enums ----------
    /// @notice Lifecycle states of a game.
    enum State {
        Active, // Game ongoing
        Boom, // Player hit a bomb
        CashedOut // Player cashed out safely
    }

    // --------- Game struct ----------
    /// @notice Stores all on-chain encrypted state of a single game.
    struct Game {
        address player; // Owner of this game instance
        uint8 boardSize; // Number of tiles in board (1D Minesweeper)
        euint32[] board; // Encrypted tiles: 0 = safe, 1 = bomb
        bytes32 commitHash; // Commitment: H(seed, player, boardSize)
        uint32 openedCount; // Count of opened tiles (plaintext, not sensitive)
        euint32 multiplier; // Encrypted multiplier (x1000), grows with safe picks
        State state; // Current game state
        bool seedRevealed; // True after player calls revealSeed() successfully
    }

    // --------- Constants ----------
    uint32 public constant MULTIPLIER_BASE = 1000; // 1.00x multiplier (initial)
    uint32 public constant MULTIPLIER_STEP = 1050; // Each safe tile multiplies by +5% (x1.05)

    // --------- Storage ----------
    uint256 public gameCounter; // Global counter for game IDs
    mapping(uint256 => Game) public games; // All active/ended games

    // --------- Events ----------
    event GameCreated(uint256 indexed gameId, address indexed player, uint8 boardSize);
    /// @dev Emits encrypted isBomb (ebool) -> does not leak actual plaintext tile.
    event TilePicked(uint256 indexed gameId, uint256 index, ebool isBomb, uint32 openedCount, euint32 newMultiplier);
    event GameEnded(uint256 indexed gameId, euint32 finalMultiplier, State state);
    /// @dev Proof of fairness: user reveals their original seed.
    event SeedRevealed(uint256 indexed gameId, uint256 seed);
    /// @dev Optional transparency: plaintext board can be emitted after end.
    event GameRevealed(uint256 indexed gameId, uint32[] plainMap);

    // ------------------------------------------------------------------------
    // 🟢 Game Creation
    // ------------------------------------------------------------------------
    /// @notice Starts a new encrypted Minesweeper game.
    /// @param encryptedTiles Encrypted tiles as external handles (0=safe, 1=bomb).
    /// @param proof Batch input proof for FHE encryption.
    /// @param commitHash Commitment hash = keccak256(seed, msg.sender, boardSize).
    /// @param boardSize Declared number of tiles (must match encryptedTiles.length).
    /// @return gameId ID of the newly created game.
    function createGame(
        externalEuint32[] calldata encryptedTiles,
        bytes calldata proof,
        bytes32 commitHash,
        uint8 boardSize
    ) external returns (uint256 gameId) {
        require(boardSize > 0, "Invalid board size");
        require(encryptedTiles.length == boardSize, "Board size mismatch");
        require(commitHash != bytes32(0), "Empty commit");

        // Load encrypted tiles into secure memory
        euint32[] memory board = new euint32[](encryptedTiles.length);
        for (uint256 i = 0; i < encryptedTiles.length; i++) {
            board[i] = FHE.fromExternal(encryptedTiles[i], proof);
            FHE.allowThis(board[i]); // Contract itself can compute with it
        }

        // Initialize multiplier = 1.00x (encrypted)
        euint32 startMul = FHE.asEuint32(MULTIPLIER_BASE);
        FHE.allowThis(startMul);
        FHE.allow(startMul, msg.sender); // Player can decrypt multiplier

        // Persist game
        gameId = ++gameCounter;
        games[gameId] = Game({
            player: msg.sender,
            boardSize: boardSize,
            board: board,
            commitHash: commitHash,
            openedCount: 0,
            multiplier: startMul,
            state: State.Active,
            seedRevealed: false
        });

        emit GameCreated(gameId, msg.sender, boardSize);
    }

    // ------------------------------------------------------------------------
    // 🟢 Gameplay
    // ------------------------------------------------------------------------
    /// @notice Player picks a tile by index.
    /// @dev Emits encrypted boolean `isBomb` (0/1) -> ensures privacy, no leakage.
    function pickTile(uint256 gameId, uint256 index) external {
        Game storage g = games[gameId];
        require(g.state == State.Active, "Not active");
        require(msg.sender == g.player, "Not your game");
        require(index < g.board.length, "Invalid index");

        euint32 tile = g.board[index];
        ebool isBomb = FHE.eq(tile, FHE.asEuint32(1)); // Compare encrypted tile with "1"

        // Track opened tiles in plaintext (UX-friendly)
        g.openedCount++;

        // Update multiplier = multiplier * 1.05 (still encrypted)
        euint32 grown = FHE.mul(g.multiplier, FHE.asEuint32(MULTIPLIER_STEP));
        FHE.allowThis(grown);
        FHE.allow(grown, msg.sender);
        g.multiplier = grown;

        emit TilePicked(gameId, index, isBomb, g.openedCount, g.multiplier);
    }

    /// @notice Player voluntarily cashes out their current multiplier.
    function cashOut(uint256 gameId) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.Active, "Not active");

        g.state = State.CashedOut;
        emit GameEnded(gameId, g.multiplier, g.state);
    }

    /// @notice End game as Boom (player hit a bomb).
    /// @dev Typically called by frontend if `isBomb` was decrypted as true.
    function endAsBoom(uint256 gameId) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.Active, "Not active");

        g.state = State.Boom;
        emit GameEnded(gameId, g.multiplier, g.state);
    }

    // ------------------------------------------------------------------------
    // 🟢 Provably-Fair Reveal
    // ------------------------------------------------------------------------
    /// @notice Player reveals their original seed to prove fairness.
    /// @dev Contract recomputes commit = keccak256(seed, player, boardSize).
    function revealSeed(uint256 gameId, uint256 seed) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.CashedOut || g.state == State.Boom, "Not ended");

        bytes32 expected = keccak256(abi.encode(seed, g.player, g.boardSize));
        require(expected == g.commitHash, "Commit mismatch");

        g.seedRevealed = true;
        emit SeedRevealed(gameId, seed);
    }

    /// @notice Player can also reveal the full plaintext board after game ends.
    /// @dev Optional — helps external verify tools reconstruct the board.
    function revealGame(uint256 gameId, uint32[] calldata plainMap) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.CashedOut || g.state == State.Boom, "Not ended");

        emit GameRevealed(gameId, plainMap);
    }

    // ------------------------------------------------------------------------
    // 🟢 View helpers (read-only)
    // ------------------------------------------------------------------------
    function getMultiplier(uint256 gameId) external view returns (euint32) {
        return games[gameId].multiplier;
    }

    function getOpenedCount(uint256 gameId) external view returns (uint32) {
        return games[gameId].openedCount;
    }

    function getBoardSize(uint256 gameId) external view returns (uint8) {
        return games[gameId].boardSize;
    }

    function getState(uint256 gameId) external view returns (State) {
        return games[gameId].state;
    }

    function getCommit(uint256 gameId) external view returns (bytes32) {
        return games[gameId].commitHash;
    }

    function isSeedRevealed(uint256 gameId) external view returns (bool) {
        return games[gameId].seedRevealed;
    }
}
