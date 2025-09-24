import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react'

export function useWallet() {
  const { address, isConnected } = useAppKitAccount()
  const { disconnect } = useDisconnect();
  const { open } = useAppKit()

  const connectWallet = async () => {
    try {
      await open()
    } catch (err) {
      console.error('❌ Connect failed:', err)
    }
  }

  const disconnectWallet = async () => {
    try {
      await disconnect()
    } catch (err) {
      console.error('❌ Disconnect failed:', err)
    }
  }

  return { address, isConnected, connectWallet, disconnectWallet }
}
