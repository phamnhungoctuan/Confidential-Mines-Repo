import React from "react";

export default function VerifyModal({ gameId, show, decryptedRows, verifying, verifyError, closeVerifyModal }: any) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60,
      }}
      onClick={closeVerifyModal}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          width: "min(920px, 96%)", maxHeight: "90vh", overflowY: "auto",
          background: "#111", borderRadius: 12, padding: 20, color: "#fff",
          boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
        }}
      >
        <h2>🔎 Verify Fairness — Game #{gameId}</h2>

        {verifyError && <div style={{ color: "#e74c3c", marginBottom: 12 }}>{verifyError}</div>}

        <div style={{ minHeight: 120 }}>
          {verifying ? (
            <div style={{ color: "#aaa", textAlign: "center", padding: 24 }}>
              ⏳ Decrypting board with FHEVM technology — please sign the wallet prompt if requested...
            </div>
          ) : decryptedRows ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {decryptedRows.map((r: number[], ri: number) => (
                <div key={ri} style={{ display: "flex", gap: 8 }}>
                  {r.map((v, ci) => (
                    <div key={ci}
                      style={{
                        width: 32, height: 32, borderRadius: 6,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: v === 1 ? "#c0392b" : "#27ae60",
                      }}>
                      {v === 1 ? "💣" : ""}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={closeVerifyModal} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#777" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
