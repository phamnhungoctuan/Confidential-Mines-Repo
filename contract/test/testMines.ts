import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { ConfidentialMines, ConfidentialMines__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ConfidentialMines")) as ConfidentialMines__factory;
  const mines = (await factory.deploy()) as ConfidentialMines;
  return { mines, minesAddress: await mines.getAddress() };
}

// Helper: pack board into uint64
function packBoard(board: number[]): bigint {
  let packed = 0n;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === 1) {
      packed |= (1n << BigInt(i));
    }
  }
  return packed;
}

// Encrypt packed board (single euint64)
async function encryptPackedBoard(packed: bigint, contract: string, user: string) {
  const enc = await fhevm.createEncryptedInput(contract, user);
  enc.add64(packed); // single uint64
  const res = await enc.encrypt();
  return { encryptedPackedBoard: res.handles[0], proof: res.inputProof };
}

describe("ConfidentialMines (bit-packed)", () => {
  let signers: Signers;
  let mines: ConfidentialMines;
  let minesAddress: string;

  before(async () => {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("⚠️ Skipping tests: not running on fhEVM mock");
      this.skip();
    }
    ({ mines, minesAddress } = await deployFixture());
  });

  it("should create game, pick a SAFE tile, end and reveal seed", async () => {
    const board = [0, 0, 1, 0, 0];
    const seed = 123456;
    const packed = packBoard(board);

    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "uint8"],
        [seed, signers.alice.address, board.length],
      ),
    );
    const ciphertextCommit = ethers.keccak256("0xdeadbeef"); // mock ciphertext commitment

    const { encryptedPackedBoard, proof } = await encryptPackedBoard(packed, minesAddress, signers.alice.address);

    const receipt = await (
      await mines.connect(signers.alice).createGame(
        encryptedPackedBoard,
        proof,
        commitHash,
        ciphertextCommit,
        board.length
      )
    ).wait();

    const gameId = receipt?.logs.find((l) => l.fragment?.name === "GameCreated")?.args?.[0];

    // pick SAFE at index 0
    await mines.connect(signers.alice).pickTile(gameId, 0);
    expect(await mines.getOpenedCount(gameId)).to.eq(1);

    // end game (cashout/boom off-chain)
    await mines.connect(signers.alice).endGame(gameId);
    expect(await mines.getState(gameId)).to.eq(1); // Ended enum = 1

    // reveal seed (must match commit)
    await expect(mines.connect(signers.alice).revealSeed(gameId, seed)).to.not.be.reverted;
  });

  it("should reject wrong seed", async () => {
    const board = [0, 1, 0];
    const seed = 111;
    const wrongSeed = 222;
    const packed = packBoard(board);

    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "address", "uint8"],
        [seed, signers.alice.address, board.length],
      ),
    );
    const ciphertextCommit = ethers.keccak256("0x1234");

    const { encryptedPackedBoard, proof } = await encryptPackedBoard(packed, minesAddress, signers.alice.address);

    const receipt = await (
      await mines.connect(signers.alice).createGame(
        encryptedPackedBoard,
        proof,
        commitHash,
        ciphertextCommit,
        board.length
      )
    ).wait();

    const gameId = receipt?.logs.find((l) => l.fragment?.name === "GameCreated")?.args?.[0];

    await mines.connect(signers.alice).pickTile(gameId, 0);
    await mines.connect(signers.alice).endGame(gameId);

    // wrong seed
    await expect(mines.connect(signers.alice).revealSeed(gameId, wrongSeed)).to.be.revertedWith("Commit mismatch");
  });
});
