import { useState } from "react";
import { shortAddr } from "./utils/format";
import Board from "./components/Board";
import VerifyModal from "./components/VerifyModal";
import { handleVerifyClick, verifyGame } from "./services/verifier";
import { useGame } from "./hooks/useGame";
import { useWallet } from "./services/wallet";
import { useAppKitProvider } from "@reown/appkit/react";
import type { Provider } from "@reown/appkit/react";


export default function App() {
  const { address, isConnected, connectWallet, disconnectWallet } = useWallet();

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
  } = useGame(address ?? null);

  // Verify modal state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [decryptedRows, setDecryptedRows] = useState<number[][] | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const { walletProvider } = useAppKitProvider<Provider>("eip155");

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
          {isConnected ? (
            <>
              <p>✅ Connected: {shortAddr(address!)}</p>
              <button onClick={disconnectWallet}>Disconnect</button>
            </>
          ) : (
            <button onClick={connectWallet}>Connect Wallet</button>
          )}

          {!isActive && !proofJson && (
            <button
              onClick={handleStart}
              disabled={!address || loadingStep !== ""}
              style={{
                marginLeft: 12,
                background: !address
                  ? "#444"
                  : loadingStep !== ""
                  ? "#555"
                  : "#f39c12",
                border: "none",
                borderRadius: 10,
                color: "#111",
                cursor: !address ? "not-allowed" : "pointer",
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
                  walletProvider,
                  gameId,
                  (show: any) => {
                    setShowVerifyModal(show);
                    if (show) setVerifyLoading(false);
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
            <button
            onClick={() => {
              let resultText = "I just played a provably fair game using Zama’s #FHEVM encryption!";

              if (state) {
                if (state.boom) {
                  resultText = `I just lost 💥 after opening ${state.safeCount} safe tiles in a provably fair game using Zama’s #FHEVM encryption!`;
                } else if (state.safeCount > 0) {
                  resultText = `I just won 🎉 a provably fair game using Zama’s #FHEVM encryption with a ${state.multiplier}x multiplier!`;
                }
              }

              const gameUrl = "https://confidential-mines.vercel.app";
              const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                `${resultText} Try it out here: ${gameUrl}`
              )}`;
              window.open(tweetUrl, "_blank");
            }}
            style={{
              padding: "10px 18px",
              background: "#1DA1F2",
              border: "none",
              borderRadius: 10,
              color: "#fff",
              cursor: "pointer",
            }}
          >
            🐦 Share on X
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
        <p>
          <a
            href="https://github.com/phamnhungoctuan"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#bbb", textDecoration: "none" }}
          >
            🐙 https://github.com/phamnhungoctuan
          </a>
        </p>

        <p
          style={{
            marginTop: 20,
            fontSize: 13,
            color: "#e67e22",
            fontStyle: "italic",
          }}
        >
          ⚠️ This game runs on the <strong>Sepolia test network</strong> and is for demo purposes only.  
        </p>
      </footer>
    </div>
  );
}
