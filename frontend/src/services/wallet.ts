export async function connectWallet(setAccount: (a: string) => void) {
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
            params: [{
              chainId: sepoliaChainId,
              chainName: "Sepolia Test Network",
              nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.sepolia.org"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            }],
          });
        }
      }
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (accounts && accounts.length > 0) setAccount(accounts[0]);
  } catch (err) {
    console.error("❌ Connect failed:", err);
  }
}

export function disconnectWallet(setAccount: (a: string | null) => void) {
  setAccount(null);
}
