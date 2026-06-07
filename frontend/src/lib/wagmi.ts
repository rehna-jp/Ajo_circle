import { createConfig } from '@privy-io/wagmi'
import { http } from 'wagmi'
import { celo } from 'viem/chains'

export const wagmiConfig = createConfig({
  chains: [celo],
  transports: {
    [celo.id]: http(
      process.env.NEXT_PUBLIC_RPC_URL ?? 'https://forno.celo.org',
    ),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
