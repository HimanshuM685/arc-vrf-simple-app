import { formatEther } from 'viem'
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { arcTestnet, short } from '../lib/config'

export function Wallet() {
  const { address, chainId, isConnected } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: bal } = useBalance({ address, chainId: arcTestnet.id, query: { refetchInterval: 10_000 } })

  if (!isConnected) {
    const injected = connectors[0]
    return (
      <div className="text-right">
        <button
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-ground hover:opacity-90 disabled:opacity-50"
          disabled={isPending || !injected}
          onClick={() => connect({ connector: injected, chainId: arcTestnet.id })}
        >
          {isPending ? 'Opening wallet…' : 'Connect wallet'}
        </button>
        {error && <p className="mt-1 max-w-56 text-xs text-fail">{error.message.split('\n')[0]}</p>}
      </div>
    )
  }

  if (chainId !== arcTestnet.id) {
    return (
      <button
        className="rounded-full bg-wait px-4 py-2 text-sm font-semibold text-paper"
        onClick={() => switchChain({ chainId: arcTestnet.id })}
      >
        Switch to Arc Testnet
      </button>
    )
  }

  return (
    <button
      className="rounded-full border border-rule bg-paper px-4 py-2 text-sm hover:border-ink"
      title="Disconnect"
      onClick={() => disconnect()}
    >
      <span className="hex">{short(address!, 4)}</span>
      {bal && <span className="ml-2 text-muted">{Number(formatEther(bal.value)).toFixed(3)} USDC</span>}
    </button>
  )
}
