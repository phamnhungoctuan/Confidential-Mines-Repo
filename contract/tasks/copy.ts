import { task } from "hardhat/config";
import fs from "fs";
import path from "path";

task("copy-abi", "Copy ABI to frontend").setAction(async () => {
  const src = path.join(__dirname, "../artifacts/contracts/ConfidentialMines.sol/ConfidentialMines.json");
  const destDir = path.join(__dirname, "../../frontend/src/abi");
  const dest = path.join(destDir, "ConfidentialMines.json");

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  fs.copyFileSync(src, dest);
  console.log(`✅ ABI copied to ${dest}`);
});

task("compile", "Compile contracts and copy ABI").setAction(
  async (args, hre, runSuper) => {
    await runSuper(args);
    await hre.run("copy-abi");
  }
);
