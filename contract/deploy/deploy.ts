import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedMines = await deploy("ConfidentialMines", {
    from: deployer,
    log: true,
  });

  console.log(`✅ ConfidentialMines deployed at: ${deployedMines.address}`);
};

export default func;

func.id = "deploy_confidentialMines"; // để tránh chạy lại nhiều lần
func.tags = ["ConfidentialMines"];
