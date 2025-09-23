export function generateBoard(rows: number, difficulty: "easy" | "medium" | "hard"): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < rows; r++) {
    let cols: number;
    if (difficulty === "easy") {
      cols = r === 0 ? Math.floor(Math.random() * 2) + 5 : Math.floor(Math.random() * 2) + 3;
    } else if (difficulty === "medium") {
      cols = r === 0 ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 3) + 2;
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

export function openAllBoard(board: number[][]) {
  const allTiles = new Set<string>();
  board.forEach((row, r) => row.forEach((_, c) => allTiles.add(`${r}-${c}`)));
  return allTiles;
}
