import { useState } from "react";
import { ethers } from "ethers";
import ConfidentialMinesAbi from "../abi/ConfidentialMines.json";
import { createGame, pickTileLocal } from "../services/contract"; 
import { generateBoard, openAllBoard } from "../utils/board";
import { getErrorMessage } from "../errors";

const ROWS = 6;

export function useGame(account: string | null) {
  const [gameId, setGameId] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [board, setBoard] = useState<number[][]>([]);
  const [seed, setSeed] = useState<number>(0);
  const [isActive, setIsActive] = useState(false);

  const [state, setState] = useState({ safeCount: 0, multiplier: 1.0, boom: false });
  const [openedTiles, setOpenedTiles] = useState<Set<string>>(new Set());
  const [pickedTiles, setPickedTiles] = useState<Set<string>>(new Set());
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set());

  const [statusMsg, setStatusMsg] = useState("");
  const [loadingStep, setLoadingStep] = useState<"" | "encrypt" | "confirm" | "onchain">("");
  const [progress, setProgress] = useState(0);

  const [proofJson, setProofJson] = useState<any | null>(null);

  async function handleStart() {
    if (!account) {
      setStatusMsg("⚠️ Please connect your wallet before starting the game");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const balance = await provider.getBalance(account);
      if (balance === 0n) {
        setStatusMsg("⚠️ Your Sepolia wallet has insufficient ETH balance to start the game");
        return;
      }
    } catch (err) {
      setStatusMsg("⚠️ Could not verify wallet balance");
      return;
    }

    const newSeed = Math.floor(Math.random() * 1_000_000);
    const newBoard = generateBoard(ROWS, difficulty);

    setSeed(newSeed);
    setBoard(newBoard);
    setState({ safeCount: 0, multiplier: 1.0, boom: false });
    setIsActive(true);
    setOpenedTiles(new Set());
    setPickedTiles(new Set());
    setRevealedRows(new Set());
    setProofJson(null);

    setLoadingStep("encrypt");
    setStatusMsg("🔐 Encrypting board with FHEVM...");

    setProgress(0);
    const totalTime = 12000;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.floor((elapsed / totalTime) * 100));
      setProgress(pct);
      if (pct === 100) clearInterval(timer);
    }, 200);

    try {
      const tx = await createGame(newBoard.flat(), newSeed);
      clearInterval(timer);

      setLoadingStep("confirm");
      setStatusMsg("🦊 Please confirm transaction in MetaMask...");

      setLoadingStep("onchain");
      setStatusMsg("⏳ Waiting for on-chain confirmation...");

      const receipt = await tx.wait();
      const iface = new ethers.Interface(ConfidentialMinesAbi.abi);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "GameCreated") {
            setGameId(Number(parsed.args[0]));
            break;
          }
        } catch {}
      }

      setRevealedRows(new Set([ROWS - 1]));
      setStatusMsg("✅ Game created! Start picking from the bottom row.");
    } catch (err: any) {
      console.error("❌ createGame failed:", err);
      const rawCode =
        err.code === "INSUFFICIENT_FUNDS" || err.message?.toLowerCase().includes("insufficient funds")
          ? "INSUFFICIENT_BALANCE"
          : err.message?.toLowerCase().includes("user rejected")
          ? "USER_REJECTED"
          : err.code || err.message || "UNKNOWN_ERROR";
      setStatusMsg(getErrorMessage(rawCode));
      setIsActive(false);
    } finally {
      setLoadingStep("");
    }
  }

  function handlePick(row: number, col: number) {
    if (!isActive || state.boom) return;
    if (!revealedRows.has(row)) return;

    const key = `${row}-${col}`;
    if (openedTiles.has(key)) return;

    setPickedTiles((prev) => new Set(prev).add(key));
    const newOpened = new Set(openedTiles).add(key);
    setOpenedTiles(newOpened);

    const flatIndex = board.slice(0, row).reduce((acc, r) => acc + r.length, 0) + col;
    const result = pickTileLocal(board.flat(), flatIndex, {
      safeCount: state.safeCount,
      multiplier: state.multiplier * 1000,
    } as any);

    setState({
      safeCount: (result as any).safeCount,
      multiplier: (result as any).multiplier / 1000,
      boom: (result as any).boom,
    });

    if ((result as any).boom) {
      setIsActive(false);
      setStatusMsg("💥 BOOM! You hit a bomb and lost.");
      setProofJson({ board: board.flat(), seed, player: account, boardSize: board.flat().length });
      setOpenedTiles(openAllBoard(board));
    } else {
      if (row > 0) {
        const newOpenedRow = new Set(openedTiles);
        board[row].forEach((_, c) => newOpenedRow.add(`${row}-${c}`));
        setOpenedTiles(newOpenedRow);

        setRevealedRows((prev) => {
          const updated = new Set(prev);
          updated.delete(row);
          updated.add(row - 1);
          return updated;
        });
      } else {
        setIsActive(false);
        setStatusMsg("🏆 Congratulations! You won the game!");
        setProofJson({ board: board.flat(), seed, player: account, boardSize: board.flat().length });
        setOpenedTiles(openAllBoard(board));
      }
    }
  }

  return {
    gameId,
    board,
    state,
    openedTiles,
    pickedTiles,
    revealedRows,
    isActive,
    difficulty,
    setDifficulty,
    handleStart,
    handlePick,
    statusMsg,
    loadingStep,
    progress,
    proofJson,
  };
}
