import { useState, useEffect } from "react";
import { connectWallet, disconnectWallet } from "./services/wallet";
import { shortAddr } from "./utils/format";
import Board from "./components/Board";
import VerifyModal from "./components/VerifyModal";
import { handleVerifyClick, verifyGame } from "./services/verifier";
import { useGame } from "./hooks/useGame";

export default function App() {
  const [account, setAccount] = useState<string | null>(null);

  // Auto-connect if already authorized
  useEffect(() => {
    (async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          if (accounts && accounts.length > 0) {
            setAccount(accounts[0]);
          }
        } catch (err) {
          console.error("❌ Failed to auto-connect:", err);
        }
      }
    })();
  }, []);

  const {
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
  } = useGame(account);

  // Verify modal state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [decryptedRows, setDecryptedRows] = useState<number[][] | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  function closeVerifyModal() {
    setShowVerifyModal(false);
    setDecryptedRows(null);
    setVerifyError(null);
  }

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
      {/* Animations */}
      <style>{`
        @keyframes pulse { 0% { transform: scale(1);} 50% { transform: scale(1.1);} 100% { transform: scale(1);} }
        @keyframes shake { 0% { transform: translateX(0);} 25% { transform: translateX(-5px);} 50% { transform: translateX(5px);} 75% { transform: translateX(-5px);} 100% { transform: translateX(0);} }
        @keyframes glowPath { 0% { box-shadow: 0 0 0px rgba(241,196,15,0.0);} 50% { box-shadow: 0 0 15px rgba(241,196,15,0.9);} 100% { box-shadow: 0 0 0px rgba(241,196,15,0.0);} }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 48, marginBottom: 8 }}>🎮 Confidential Mines</h1>

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

        {/* Wallet + Start */}
        <div style={{ marginTop: 24 }}>
          {!account ? (
            <button
              onClick={() => connectWallet(setAccount)}
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
              onClick={() => disconnectWallet(setAccount)}
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
                background: !account
                  ? "#444"
                  : loadingStep !== ""
                  ? "#555"
                  : "#f39c12",
                border: "none",
                borderRadius: 10,
                color: "#111",
                cursor: !account ? "not-allowed" : "pointer",
              }}
            >
              {loadingStep ? "⏳ Starting..." : "⚡ Start Game"}
            </button>
          )}
        </div>

        {/* Status */}
        {loadingStep && (
          <div style={{ marginTop: 16 }}>
            <progress value={progress} max={100} style={{ width: "60%" }} />
            <p style={{ fontSize: 14, color: "#aaa" }}>{statusMsg}</p>
          </div>
        )}
        {!loadingStep && statusMsg && (
          <div style={{ marginTop: 16, fontStyle: "italic" }}>{statusMsg}</div>
        )}

        {/* Game Board */}
        <Board
          board={board}
          openedTiles={openedTiles}
          pickedTiles={pickedTiles}
          revealedRows={revealedRows}
          state={state}
          handlePick={handlePick}
        />

        {/* After game over: New Game + Verify */}
        {!isActive && proofJson && gameId && (
          <div style={{ marginTop: 20, display: "flex", justifyContent: "center", gap: 12 }}>
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
              🔄 New Game
            </button>
            <button
              onClick={() => {
                setVerifyLoading(true);
                handleVerifyClick(
                  gameId,
                  (show) => {
                    setShowVerifyModal(show);
                    if (show) setVerifyLoading(false); // chỉ tắt khi modal bật
                  },
                  () => {},
                  setVerifyError,
                  () => {},
                  (prepared: any) =>
                    verifyGame(
                      prepared,
                      () => {},
                      setDecryptedRows,
                      () => {},
                      setVerifyError,
                      setVerifying,
                      board
                    )
                );
              }}
              disabled={verifyLoading}
              style={{
                padding: "10px 18px",
                background: verifyLoading ? "#555" : "#8e44ad",
                border: "none",
                borderRadius: 10,
                color: "#fff",
                cursor: verifyLoading ? "wait" : "pointer",
              }}
            >
              {verifyLoading ? "⏳ Verifying..." : "🔎 Verify Fairness"}
            </button>
          </div>
        )}
      </div>

      {/* Verify Modal */}
      <VerifyModal
        gameId={gameId}
        show={showVerifyModal}
        decryptedRows={decryptedRows}
        verifying={verifying}
        verifyError={verifyError}
        closeVerifyModal={closeVerifyModal}
      />

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
          <a
            href="https://zama.ai"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#bbb" }}
          >
            ZAMA
          </a>
        </p>
      </footer>
    </div>
  );
}
