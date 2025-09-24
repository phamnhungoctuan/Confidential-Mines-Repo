export default function VerifyModal({
  gameId,
  show,
  decryptedRows,
  verifying,
  verifyError,
  closeVerifyModal
}: any) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
      }}
      onClick={closeVerifyModal}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          width: "min(600px, 96%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#111",
          borderRadius: 12,
          padding: 20,
          color: "#fff",
          boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: 20 }}>
          🔎 Verify Fairness — Game #{gameId}
        </h2>

        {!verifying && (
          <p
            style={{
              textAlign: "center",
              fontSize: 14,
              marginBottom: 20,
              color: verifyError ? "#e74c3c" : "#2ecc71",
              fontWeight: "bold",
            }}
          >
            {verifyError
              ? "❌ Verification failed — the revealed board does not match the commitment."
              : decryptedRows
              ? "✅ This game is provably fair — the revealed board matches the original commitment."
              : ""}
          </p>
        )}

        {verifyError && (
          <div
            style={{
              color: "#e74c3c",
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            {verifyError}
          </div>
        )}

        <div style={{ minHeight: 120 }}>
          {verifying ? (
            <div style={{ color: "#aaa", textAlign: "center", padding: 24 }}>
              ⏳ Decrypting board with FHEVM technology..
            </div>
          ) : decryptedRows ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {decryptedRows.map((row: number[], ri: number) => (
                  <div key={ri} style={{ display: "flex", gap: 8 }}>
                    {row.map((v, ci) => (
                      <div
                        key={ci}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: v === 1 ? "#c0392b" : "#27ae60",
                          fontSize: 18,
                        }}
                      >
                        {v === 1 ? "💣" : ""}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            marginTop: 20,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onClick={closeVerifyModal}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#777",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
