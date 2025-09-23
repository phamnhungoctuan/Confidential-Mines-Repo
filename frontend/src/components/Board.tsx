import React from "react";

interface BoardProps {
  board: number[][];
  openedTiles: Set<string>;
  pickedTiles: Set<string>;
  revealedRows: Set<number>;
  state: { boom: boolean };
  handlePick: (row: number, col: number) => void;
}

export default function Board({
  board,
  openedTiles,
  pickedTiles,
  revealedRows,
  state,
  handlePick,
}: BoardProps) {
  return (
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
            const locked = !revealedRows.has(r);
            const opened = openedTiles.has(key);
            const picked = pickedTiles.has(key);

            let bg = "#2b2b2b";
            let content = "";
            let border = "2px solid transparent";
            let boxShadow = "none";
            let anim = "none";

            if (opened) {
              bg = cell === 1 ? "#c0392b" : "#27ae60";
              content = cell === 1 ? "💀" : "";
              if (picked) {
                border = "2px solid #f1c40f";
                boxShadow = "0 0 15px rgba(241,196,15,0.9)";
                anim = "glowPath 1.2s infinite";
              } else {
                border = cell === 1 ? "2px solid #e67e22" : "2px solid #3498db";
                boxShadow =
                  cell === 1
                    ? "0 0 10px rgba(230,126,34,0.8)"
                    : "0 0 10px rgba(52,152,219,0.8)";
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
                  cursor:
                    locked || state.boom || opened ? "not-allowed" : "pointer",
                  userSelect: "none",
                  transition:
                    "background 0.3s, box-shadow 0.3s, border 0.3s",
                  animation:
                    !opened && !state.boom && r === activeRow
                      ? "pulse 1.5s infinite"
                      : anim,
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
  );
}
