import { defineChain, isAddress, type Address } from 'viem'
import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

// Arc's native gas token is USDC with 18 decimals (same definition as @arc-vrf/sdk chains.ts).
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' } },
  testnet: true,
})

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: { [arcTestnet.id]: http() },
})

/** Arc's mempool drops transactions with maxFeePerGas below 20 gwei. */
export const MIN_MAX_FEE = 20_000_000_000n

// Arc VRF on Arc Testnet, from https://arcvrf.007575.xyz/docs#addresses
export const VRF = {
  coordinator: '0xe852aAb2d5c609B89Ea2B39e1451608D8649827a',
  wrapper: '0xD854D5F611938F60D614a69Ec58033d37aF54d75',
  batchCoordinator: '0x8861dCBA2D13d6D0723C9b7E56A0D88758Dc8273',
  keyHash: '0xcf39e27191d1d13c8fec1a175eda831392ef974fe21a5a0a0680c3a22c6deb88',
} as const

const env = (v: string | undefined) => (v && isAddress(v) ? (v as Address) : undefined)

export type Mode = 'direct' | 'subscription'

export const PLAYGROUND: Record<Mode, Address | undefined> = {
  direct: env(import.meta.env.VITE_DIRECT_ADDRESS),
  subscription: env(import.meta.env.VITE_SUB_ADDRESS),
}
export const SUB_ID = import.meta.env.VITE_SUB_ID ? BigInt(import.meta.env.VITE_SUB_ID) : undefined

export const explorerTx = (hash: string) => `https://explorer.testnet.arc.io/tx/${hash}`
export const explorerAddress = (a: string) => `https://explorer.testnet.arc.io/address/${a}`
export const vrfRequestPage = (id: bigint) => `https://arcvrf.007575.xyz/requests/${id}`

export const short = (hex: string, n = 6) => (hex.length <= 2 * n + 2 ? hex : `${hex.slice(0, n + 2)}…${hex.slice(-n)}`)
