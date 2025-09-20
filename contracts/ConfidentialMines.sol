// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, ebool, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract ConfidentialMines is SepoliaConfig {
    // --------- Game state ----------
    enum State {
        Active,
        Boom,
        CashedOut
    }

    struct Game {
        address player;
        uint8 boardSize; // number of tiles (1D)
        euint32[] board; // encrypted tiles: 0 = safe, 1 = bomb
        bytes32 commitHash; // H(seed, player, boardSize)
        uint32 openedCount; // plaintext counter (safe for UX)
        euint32 multiplier; // encrypted, x1000 (start 1000)
        State state;
        bool seedRevealed; // true after successful revealSeed()
    }

    // --------- Constants ----------
    uint32 public constant MULTIPLIER_BASE = 1000; // 1.00x
    uint32 public constant MULTIPLIER_STEP = 1050; // +5% per safe open (x1.05)

    // --------- Storage ----------
    uint256 public gameCounter;
    mapping(uint256 => Game) public games;

    // --------- Events ----------
    event GameCreated(uint256 indexed gameId, address indexed player, uint8 boardSize);
    /// @dev isBomb is an encrypted boolean (ebool) -> does not leak
    event TilePicked(uint256 indexed gameId, uint256 index, ebool isBomb, uint32 openedCount, euint32 newMultiplier);
    event GameEnded(uint256 indexed gameId, euint32 finalMultiplier, State state);
    /// @dev Emitted when a player reveals the seed to prove fairness.
    event SeedRevealed(uint256 indexed gameId, uint256 seed);
    /// @dev Optional: if you still want to emit the plaintext board AFTER end.
    event GameRevealed(uint256 indexed gameId, uint32[] plainMap);

    // --------- Create game (no seed on-chain) ----------
    /// @param encryptedTiles encrypted board tiles (external handles)
    /// @param proof input proof for the batch encryption
    /// @param commitHash keccak256(abi.encode(seed, msg.sender, boardSize))
    /// @param boardSize number of tiles (must match encryptedTiles.length)
    function createGame(
        externalEuint32[] calldata encryptedTiles,
        bytes calldata proof,
        bytes32 commitHash,
        uint8 boardSize
    ) external returns (uint256 gameId) {
        require(boardSize > 0, "Invalid board size");
        require(encryptedTiles.length == boardSize, "Board size mismatch");
        require(commitHash != bytes32(0), "Empty commit");

        // Build encrypted board
        euint32[] memory board = new euint32[](encryptedTiles.length);
        for (uint256 i = 0; i < encryptedTiles.length; i++) {
            board[i] = FHE.fromExternal(encryptedTiles[i], proof);
            FHE.allowThis(board[i]);
        }

        euint32 startMul = FHE.asEuint32(MULTIPLIER_BASE);
        FHE.allowThis(startMul);
        FHE.allow(startMul, msg.sender);

        // Store game
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

    // --------- Gameplay ----------
    function pickTile(uint256 gameId, uint256 index) external {
        Game storage g = games[gameId];
        require(g.state == State.Active, "Not active");
        require(msg.sender == g.player, "Not your game");
        require(index < g.board.length, "Invalid index");

        euint32 tile = g.board[index];
        ebool isBomb = FHE.eq(tile, FHE.asEuint32(1));

        // Increase opened count (plaintext) & grow encrypted multiplier
        g.openedCount++;
        euint32 grown = FHE.mul(g.multiplier, FHE.asEuint32(MULTIPLIER_STEP));
        FHE.allowThis(grown);
        FHE.allow(grown, msg.sender);
        g.multiplier = grown;

        emit TilePicked(gameId, index, isBomb, g.openedCount, g.multiplier);
    }

    function cashOut(uint256 gameId) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.Active, "Not active");

        g.state = State.CashedOut;
        emit GameEnded(gameId, g.multiplier, g.state);
    }

    function endAsBoom(uint256 gameId) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.Active, "Not active");

        g.state = State.Boom;
        emit GameEnded(gameId, g.multiplier, g.state);
    }

    // --------- Provably-fair reveal ----------
    function revealSeed(uint256 gameId, uint256 seed) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.CashedOut || g.state == State.Boom, "Not ended");

        bytes32 expected = keccak256(abi.encode(seed, g.player, g.boardSize));
        require(expected == g.commitHash, "Commit mismatch");
        g.seedRevealed = true;

        emit SeedRevealed(gameId, seed);
    }

    function revealGame(uint256 gameId, uint32[] calldata plainMap) external {
        Game storage g = games[gameId];
        require(msg.sender == g.player, "Not your game");
        require(g.state == State.CashedOut || g.state == State.Boom, "Not ended");
        emit GameRevealed(gameId, plainMap);
    }

    // --------- View helpers ----------
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
