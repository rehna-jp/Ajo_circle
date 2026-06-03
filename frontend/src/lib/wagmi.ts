import { createConfig, http } from '@privy-io/wagmi'
import { celoAlfajores } from 'viem/chains'

export const wagmiConfig = createConfig({
  chains: [celoAlfajores],
  transports: {
    [celoAlfajores.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL ?? 'https://alfajores-forno.celo-testnet.org',
    ),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
