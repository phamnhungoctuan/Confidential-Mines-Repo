import { createAppKit } from '@reown/appkit/react'
import { sepolia } from '@reown/appkit/networks'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'

const projectId = 'd43bccd656d6c1a2f7c7693caab78e2c'

const metadata = {
  name: 'Confidential Mines',
  description: 'Provably fair confidential game',
  url: 'https://confidential-mines.vercel.app',
  icons: ['https://confidential-mines.vercel.app/logo.png']
}

createAppKit({
  adapters: [new EthersAdapter()],
  networks: [sepolia],
  metadata,
  projectId,
  features: {
    analytics: false, 
    email: false,     
    socials: false,  
    onramp: false 
  }
})
