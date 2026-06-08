import { createConfig } from '@privy-io/wagmi'
import { http } from 'wagmi'
import { injected } from '@wagmi/connectors'
import { celo } from 'viem/chains'

// Provide an InjectedConnector (e.g. MetaMask / browser wallets) so the
// wallet provider exposed to Privy implements the EIP-1193 `.on` event API.
export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [injected({ chains: [celo] })],
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
