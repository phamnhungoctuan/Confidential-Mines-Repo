import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { createGame, pickTileLocal } from "./hooks/useMines";
import ConfidentialMinesAbi from "./abi/ConfidentialMines.json";
import { getErrorMessage } from "./errors";

const ROWS = 6;

function generateBoard(rows: number, difficulty: "easy" | "medium" | "hard"): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < rows; r++) {
    let cols: number;

    if (difficulty === "easy") {
      if (r === 0) cols = Math.floor(Math.random() * 2) + 5;
      else cols = Math.floor(Math.random() * 2) + 3;
    } else if (difficulty === "medium") {
      if (r === 0) cols = Math.floor(Math.random() * 3) + 4;
      else cols = Math.floor(Math.random() * 3) + 2;
    } else {
      cols = Math.floor(Math.random() * 2) + 2;
    }

    const row = Array(cols).fill(0);
    const bombIndex = Math.floor(Math.random() * cols);
    row[bombIndex] = 1;
    out.push(row);
  }
  return out;
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function openVerify(gameId: number, proof: any) {
  const win = window.open("", "_blank");
  fetch("https://confidential-mines-verify.vercel.app/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, proofJson: proof }),
  })
    .then((res) => res.text())
    .then((html) => {
      if (win) win.document.write(html);
    })
    .catch((err) => {
      if (win) win.document.write(`<p style="color:red">Error: ${err.message}</p>`);
    });
}

export default function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState<"" | "encrypt" | "confirm" | "onchain">("");
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");

  const [gameId, setGameId] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [board, setBoard] = useState<number[][]>([]);
  const [seed, setSeed] = useState<number>(0);
  const [isActive, setIsActive] = useState(false);

  const [state, setState] = useState({ safeCount: 0, multiplier: 1.0, boom: false });
  const [openedTiles, setOpenedTiles] = useState<Set<string>>(new Set());
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set());

  const [proofJson, setProofJson] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          if (accounts && accounts.length > 0) setAccount(accounts[0]);
        } catch {}
      }
    })();
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("⚠️ MetaMask not detected");
      return;
    }

    try {
      const sepoliaChainId = "0xaa36a7";
      const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (currentChainId !== sepoliaChainId) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: sepoliaChainId }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: sepoliaChainId,
                  chainName: "Sepolia Test Network",
                  nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
                  rpcUrls: ["https://rpc.sepolia.org"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
          } else {
            console.error("❌ Failed to switch chain:", switchError);
            return;
          }
        }
      }

      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
      }
    } catch (err) {
      console.error("❌ Connect failed:", err);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setGameId(null);
    setIsActive(false);
    setProofJson(null);
  };

  const handleStart = async () => {
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
      console.error("❌ Failed to check balance:", err);
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
    } catch (err) {
      console.error("❌ createGame failed:", err);

      const e = err as { code?: string; message?: string };
      let rawCode: string;

      if (e.code === "INSUFFICIENT_FUNDS" || e.message?.toLowerCase().includes("insufficient funds")) {
        rawCode = "INSUFFICIENT_BALANCE";
      } else if (e.message?.toLowerCase().includes("user rejected")) {
        rawCode = "USER_REJECTED";
      } else {
        rawCode = e.code || e.message || "UNKNOWN_ERROR";
      }

      setStatusMsg(getErrorMessage(rawCode));
      setIsActive(false);
    } finally {
      setLoadingStep("");
    }
  };

  const handlePick = (row: number, col: number) => {
    if (!isActive || state.boom) return;
    if (!revealedRows.has(row)) return;

    const key = `${row}-${col}`;
    if (openedTiles.has(key)) return;

    const newOpened = new Set(openedTiles);
    newOpened.add(key);
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
    } else {
      if (row > 0) {
        // 🔹 Hiện tất cả ô của hàng hiện tại
        const newOpenedRow = new Set(openedTiles);
        board[row].forEach((_, c) => newOpenedRow.add(`${row}-${c}`));
        setOpenedTiles(newOpenedRow);

        // 🔹 Mở khóa hàng trên, khóa lại hàng hiện tại
        setRevealedRows((prev) => {
          const updated = new Set(prev);
          updated.delete(row); // khoá lại hàng vừa thoát
          updated.add(row - 1);
          return updated;
        });
      } else {
        setIsActive(false);
        setStatusMsg("🏆 Congratulations! You won the game!");
        setProofJson({ board: board.flat(), seed, player: account, boardSize: board.flat().length });
      }
    }
  };

  return (
    <div
      style={{
        background: "#0d0d0d",
        color: "white",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontSize: 48, margin: "12px 0" }}>
          🎮 <span style={{ fontWeight: 800 }}>Confidential Mines</span>
        </h1>

        {/* Difficulty selector */}
        <div style={{ marginTop: 16 }}>
          <span style={{ marginRight: 8 }}>🎚 Difficulty: </span>
          {["easy", "medium", "hard"].map((level) => (
            <button
              key={level}
              onClick={() => setDifficulty(level as any)}
              style={{
                margin: "0 6px",
                padding: "8px 14px",
                background: difficulty === level ? "#f39c12" : "#555",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Wallet controls */}
        <div style={{ marginTop: 24 }}>
          {!account ? (
            <button
              onClick={connectWallet}
              style={{
                padding: "12px 18px",
                background: "#1f1f1f",
                border: "none",
                borderRadius: 10,
                color: "#fff",
              }}
            >
              🦊 Connect Wallet
            </button>
          ) : (
            <button
              onClick={disconnectWallet}
              style={{
                padding: "12px 18px",
                background: "#27ae60",
                border: "none",
                borderRadius: 10,
                color: "#fff",
              }}
            >
              {shortAddr(account)} (Disconnect)
            </button>
          )}

          {!isActive && !proofJson && (
            <button
              onClick={handleStart}
              disabled={!account || loadingStep !== ""}
              style={{
                padding: "12px 18px",
                marginLeft: 12,
                background: !account ? "#444" : loadingStep !== "" ? "#555" : "#f39c12",
                border: "none",
                borderRadius: 10,
                color: "#111",
                cursor: !account ? "not-allowed" : "pointer",
              }}
            >
              {loadingStep !== "" ? "⏳ Starting..." : "⚡ Start Game"}
            </button>
          )}
        </div>

        {/* Loading bar */}
        {loadingStep && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            {loadingStep === "encrypt" && <progress value={progress} max={100} style={{ width: "60%" }} />}
            <p style={{ fontSize: 14, color: "#aaa" }}>{statusMsg}</p>
          </div>
        )}
        {!loadingStep && statusMsg && (
          <div style={{ marginTop: 16, textAlign: "center", fontStyle: "italic" }}>{statusMsg}</div>
        )}

        {/* Board */}
        <div
          style={{
            display: "flex",
            flexDirection: "column-reverse",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 32,
            animation: state.boom ? "shake 0.5s" : "",
          }}
        >
          {board.map((row, r) => (
            <div key={r} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
              {row.map((cell, c) => {
                const key = `${r}-${c}`;
                let bg = "#2b2b2b";
                let content = "";
                const locked = !revealedRows.has(r);
                const opened = openedTiles.has(key);

                let border = "2px solid transparent";
                let boxShadow = "none";

                if (state.boom) {
                  bg = cell === 1 ? "#c0392b" : "#27ae60"; // màu đậm hơn
                  content = cell === 1 ? "💀" : "";
                  if (opened) {
                    if (cell === 1) {
                      border = "2px solid #e67e22"; // đỏ cam
                      boxShadow = "0 0 10px rgba(230,126,34,0.8)";
                    } else {
                      border = "2px solid #3498db"; // xanh dương
                      boxShadow = "0 0 10px rgba(52,152,219,0.8)";
                    }
                  }
                } else if (opened) {
                  bg = cell === 1 ? "#c0392b" : "#27ae60"; // màu đậm hơn
                  content = cell === 1 ? "💀" : "";
                  if (cell === 1) {
                    border = "2px solid #e67e22"; // đỏ cam
                    boxShadow = "0 0 10px rgba(230,126,34,0.8)";
                  } else {
                    border = "2px solid #3498db"; // xanh dương
                    boxShadow = "0 0 10px rgba(52,152,219,0.8)";
                  }
                }

                const activeRow = revealedRows.size > 0 ? Math.min(...revealedRows) : -1;

                return (
                  <div
                    key={c}
                    onClick={() => handlePick(r, c)}
                    style={{
                      width: "12vw",
                      height: "12vw",
                      maxWidth: 64,
                      maxHeight: 64,
                      minWidth: 40,
                      minHeight: 40,
                      background: bg,
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      cursor: locked || state.boom || opened ? "not-allowed" : "pointer",
                      userSelect: "none",
                      transition: "background 0.3s, box-shadow 0.3s, border 0.3s",
                      animation: !opened && !state.boom && r === activeRow ? "pulse 1.5s infinite" : "none",
                      border,
                      boxShadow,
                    }}
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Actions */}
        {!isActive && proofJson && gameId && (
          <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 12 }}>
            {state.boom && (
              <button
                onClick={handleStart}
                style={{
                  padding: "10px 18px",
                  background: "#e67e22",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                🔄 Create New Game
              </button>
            )}

            <button
              onClick={() => openVerify(gameId, proofJson)}
              style={{
                padding: "10px 18px",
                background: "#8e44ad",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              🔎 Verify Fairness
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer
        style={{
          marginTop: 40,
          textAlign: "center",
          fontSize: 14,
          color: "#888",
          padding: "20px 0",
          borderTop: "1px solid #333",
        }}
      >
        <p style={{ margin: "6px 0" }}>
          Using <strong>FHEVM</strong> technology from{" "}
          <a href="https://zama.ai" target="_blank" rel="noopener noreferrer" style={{ color: "#bbb" }}>
            ZAMA
          </a>
        </p>
        <a
          href="https://github.com/phamnhungoctuan"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#bbb", textDecoration: "none" }}
        >
          🐙 https://github.com/phamnhungoctuan
        </a>
      </footer>
    </div>
  );
}
