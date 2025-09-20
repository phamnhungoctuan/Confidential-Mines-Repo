import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
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

describe("ConfidentialMines", () => {
  let signers: Signers;
  let mines: ConfidentialMines;
  let minesAddress: string;

  before(async () => {
    console.log("🔥 Starting test file");
    console.log("fhevm.isMock =", fhevm.isMock);

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`⚠️ Skipping tests: not running on fhEVM mock`);
      this.skip();
    }
    ({ mines, minesAddress } = await deployFixture());
  });

  it("should create game, pick tile, cashout and reveal to verify commitHash", async () => {
    const board = [0, 0, 1, 0, 0];
    const vrfSeed = 123456;

    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["uint32[]", "uint256"], [board, vrfSeed]),
    );

    console.log("📦 Expected commitHash:", commitHash);

    const encryptedTiles: string[] = [];
    const proofs: string[] = [];
    for (const v of board) {
      const enc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
      enc.add32(v);
      const res = await enc.encrypt();
      encryptedTiles.push(res.handles[0]);
      proofs.push(res.inputProof);
    }

    // createGame
    const tx = await mines.connect(signers.alice).createGame(encryptedTiles, proofs, commitHash, vrfSeed, 5);
    await tx.wait();

    // pickTile tại index=2
    const guessEnc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
    guessEnc.add32(0);
    const guess = await guessEnc.encrypt();

    const pickIndex = 2;
    const tx2 = await mines.connect(signers.alice).pickTile(1, pickIndex, guess.handles[0], guess.inputProof);
    await tx2.wait();

    console.log(`🟢 Picked tile index ${pickIndex}, original value = ${board[pickIndex]}`);

    // cashOut
    const tx3 = await mines.connect(signers.alice).cashOut(1);
    await tx3.wait();

    // verify commitHash off-chain
    const onchain = await mines.games(1);
    console.log("📦 On-chain commitHash:", onchain.commitHash);
    expect(onchain.commitHash).to.eq(commitHash);

    // revealGame
    const tx4 = await mines.connect(signers.alice).revealGame(1, board, vrfSeed);
    const receipt = await tx4.wait();
    expect(receipt?.status).to.eq(1);
  });

  it("should play a full round with multiple picks (SAFE, SAFE, then BOMB)", async () => {
    const board = [0, 0, 1, 0, 0];
    const vrfSeed = 123456;

    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["uint32[]", "uint256"], [board, vrfSeed]),
    );

    console.log("📦 Expected commitHash:", commitHash);

    // Encrypt từng ô
    const encryptedTiles: string[] = [];
    const proofs: string[] = [];
    for (const v of board) {
      const enc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
      enc.add32(v);
      const res = await enc.encrypt();
      encryptedTiles.push(res.handles[0]);
      proofs.push(res.inputProof);
    }

    // createGame
    const tx = await mines.connect(signers.alice).createGame(encryptedTiles, proofs, commitHash, vrfSeed, 5);
    await tx.wait();

    // 🟢 Step 1: pick index=0 (SAFE)
    let pickEnc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
    pickEnc.add32(0);
    let pick = await pickEnc.encrypt();
    await (await mines.connect(signers.alice).pickTile(1, 0, pick.handles[0], pick.inputProof)).wait();
    console.log(`✅ Picked tile 0, value = ${board[0]}`);

    // 🟢 Step 2: pick index=1 (SAFE)
    pickEnc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
    pickEnc.add32(0);
    pick = await pickEnc.encrypt();
    await (await mines.connect(signers.alice).pickTile(1, 1, pick.handles[0], pick.inputProof)).wait();
    console.log(`✅ Picked tile 1, value = ${board[1]}`);

    // 💣 Step 3: pick index=2 (BOMB)
    pickEnc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
    pickEnc.add32(0);
    pick = await pickEnc.encrypt();
    await (await mines.connect(signers.alice).pickTile(1, 2, pick.handles[0], pick.inputProof)).wait();
    console.log(`💥 Picked tile 2, value = ${board[2]} (BOMB)`);

    // cashOut sau khi thua
    const tx2 = await mines.connect(signers.alice).cashOut(1);
    await tx2.wait();

    // verify commitHash
    const onchain = await mines.games(1);
    console.log("📦 On-chain commitHash:", onchain.commitHash);
    expect(onchain.commitHash).to.eq(commitHash);

    // revealGame để chứng minh map đúng
    const tx3 = await mines.connect(signers.alice).revealGame(1, board, vrfSeed);
    const receipt = await tx3.wait();
    expect(receipt?.status).to.eq(1);
  });

  it("should pick multiple tiles in the same round (SAFE → SAFE → BOMB)", async () => {
    // Bản đồ có 5 ô: [0, 0, 1, 0, 0]
    const board = [0, 0, 1, 0, 0];
    const vrfSeed = 123456;

    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["uint32[]", "uint256"], [board, vrfSeed]),
    );

    console.log("📦 Expected commitHash:", commitHash);

    // Encrypt từng ô
    const encryptedTiles: string[] = [];
    const proofs: string[] = [];
    for (const v of board) {
      const enc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
      enc.add32(v);
      const res = await enc.encrypt();
      encryptedTiles.push(res.handles[0]);
      proofs.push(res.inputProof);
    }

    // createGame
    await (await mines.connect(signers.alice).createGame(encryptedTiles, proofs, commitHash, vrfSeed, 5)).wait();

    // 🟢 Step 1: pick index=0 (SAFE)
    let guessEnc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
    guessEnc.add32(0);
    let guess = await guessEnc.encrypt();
    await (await mines.connect(signers.alice).pickTile(1, 0, guess.handles[0], guess.inputProof)).wait();
    console.log(`✅ Picked tile 0 (SAFE) value=${board[0]}`);

    // 🟢 Step 2: pick index=1 (SAFE)
    guessEnc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
    guessEnc.add32(0);
    guess = await guessEnc.encrypt();
    await (await mines.connect(signers.alice).pickTile(1, 1, guess.handles[0], guess.inputProof)).wait();
    console.log(`✅ Picked tile 1 (SAFE) value=${board[1]}`);

    // 💣 Step 3: pick index=2 (BOMB)
    guessEnc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
    guessEnc.add32(0);
    guess = await guessEnc.encrypt();
    await (await mines.connect(signers.alice).pickTile(1, 2, guess.handles[0], guess.inputProof)).wait();
    console.log(`💥 Picked tile 2 (BOMB) value=${board[2]}`);

    // ⏹ Kết thúc round
    await (await mines.connect(signers.alice).cashOut(1)).wait();

    // ✅ Kiểm tra commitHash
    const onchain = await mines.games(1);
    console.log("📦 On-chain commitHash:", onchain.commitHash);
    expect(onchain.commitHash).to.eq(commitHash);

    // ✅ revealGame để xác minh fairness
    const tx = await mines.connect(signers.alice).revealGame(1, board, vrfSeed);
    const receipt = await tx.wait();
    expect(receipt?.status).to.eq(1);
  });

  it("should create a large board (10 tiles) and pick multiple SAFE tiles", async () => {
    // Tạo bản đồ 10 ô với 2 quả bom ở cuối
    const board = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1];
    const vrfSeed = 789123;

    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["uint32[]", "uint256"], [board, vrfSeed]),
    );

    console.log("📦 Expected commitHash (10 tiles):", commitHash);

    // Encrypt từng ô
    const encryptedTiles: string[] = [];
    const proofs: string[] = [];
    for (const v of board) {
      const enc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
      enc.add32(v);
      const res = await enc.encrypt();
      encryptedTiles.push(res.handles[0]);
      proofs.push(res.inputProof);
    }

    // createGame với boardSize = 10
    await (await mines.connect(signers.alice).createGame(encryptedTiles, proofs, commitHash, vrfSeed, 10)).wait();

    // 🟢 pick 3 ô SAFE đầu tiên
    for (let i = 0; i < 3; i++) {
      const guessEnc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
      guessEnc.add32(0);
      const guess = await guessEnc.encrypt();
      await (await mines.connect(signers.alice).pickTile(1, i, guess.handles[0], guess.inputProof)).wait();
      console.log(`✅ Picked tile ${i} (SAFE) value=${board[i]}`);

      // 🔍 Giải mã multiplier để kiểm tra tăng dần
      const g = await mines.games(1);
      const raw = await fhevm.userDecryptEuint(FhevmType.euint32, g.multiplier, minesAddress, signers.alice);
      console.log(`📈 Multiplier after tile ${i}:`, Number(raw) / 1000);
    }

    // ⏹ Cashout sau khi pick 3 SAFE
    await (await mines.connect(signers.alice).cashOut(1)).wait();

    // ✅ Kiểm tra commitHash khớp
    const onchain = await mines.games(1);
    console.log("📦 On-chain commitHash:", onchain.commitHash);
    expect(onchain.commitHash).to.eq(commitHash);

    // ✅ revealGame để verify fairness
    const tx = await mines.connect(signers.alice).revealGame(1, board, vrfSeed);
    const receipt = await tx.wait();
    expect(receipt?.status).to.eq(1);
  });

  it("should create random board (5–20 tiles) and pick multiple tiles", async () => {
    // Random số ô (5 đến 20)
    const boardSize = Math.floor(Math.random() * 16) + 5;

    // Random map gồm 0/1 (SAFE/BOMB)
    const board = Array.from({ length: boardSize }, () => (Math.random() < 0.2 ? 1 : 0));
    const vrfSeed = Math.floor(Math.random() * 1_000_000);

    console.log(`🎲 Created random board of size ${boardSize}:`, board);

    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["uint32[]", "uint256"], [board, vrfSeed]),
    );
    console.log("📦 Expected commitHash:", commitHash);

    // Encrypt từng ô
    const encryptedTiles: string[] = [];
    const proofs: string[] = [];
    for (const v of board) {
      const enc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
      enc.add32(v);
      const res = await enc.encrypt();
      encryptedTiles.push(res.handles[0]);
      proofs.push(res.inputProof);
    }

    // createGame với boardSize random
    await (
      await mines.connect(signers.alice).createGame(encryptedTiles, proofs, commitHash, vrfSeed, boardSize)
    ).wait();

    // pick 3 ô đầu tiên (dù là SAFE hay BOMB)
    for (let i = 0; i < Math.min(3, boardSize); i++) {
      const guessEnc = await fhevm.createEncryptedInput(minesAddress, signers.alice.address);
      guessEnc.add32(0);
      const guess = await guessEnc.encrypt();
      await (await mines.connect(signers.alice).pickTile(1, i, guess.handles[0], guess.inputProof)).wait();
      console.log(`🎯 Picked tile ${i}, original value=${board[i]}`);

      const g = await mines.games(1);
      const raw = await fhevm.userDecryptEuint(FhevmType.euint32, g.multiplier, minesAddress, signers.alice);
      console.log(`📈 Multiplier after tile ${i}:`, Number(raw) / 1000);
    }

    // cashOut
    await (await mines.connect(signers.alice).cashOut(1)).wait();

    // verify commitHash
    const onchain = await mines.games(1);
    console.log("📦 On-chain commitHash:", onchain.commitHash);
    expect(onchain.commitHash).to.eq(commitHash);

    // revealGame
    const tx = await mines.connect(signers.alice).revealGame(1, board, vrfSeed);
    const receipt = await tx.wait();
    expect(receipt?.status).to.eq(1);
  });
});
