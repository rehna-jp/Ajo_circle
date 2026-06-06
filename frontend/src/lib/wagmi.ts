import { createConfig } from '@privy-io/wagmi'
import { http } from 'wagmi'
import { celoSepolia } from 'viem/chains'

export const wagmiConfig = createConfig({
  chains: [celoSepolia],
  transports: {
    [celoSepolia.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL ?? 'https://forno.celo-sepolia.celo-testnet.org',
    ),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
