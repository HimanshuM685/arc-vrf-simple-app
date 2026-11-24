import { useQuery } from '@tanstack/react-query'
import { formatEther, parseAbi } from 'viem'
import { useReadContract } from 'wagmi'
import { PLAYGROUND, SUB_ID, VRF, explorerAddress, type Mode } from '../lib/config'
import { callbackGas, type GameName } from '../lib/games'
import { quoteDirect } from '../lib/play'

const subAbi = parseAbi([
  'function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] consumers)',
])

const usdc = (v: bigint) => `${Number(formatEther(v)).toFixed(4)} USDC`

/** What one play costs, and who pays, in the current funding mode. */
export function Funding({ mode, game, numWords }: { mode: Mode; game: GameName; numWords: number }) {
  const quote = useQuery({
    queryKey: ['quote', game, numWords],
    queryFn: () => quoteDirect(game, numWords),
    enabled: mode === 'direct' && !!PLAYGROUND.direct,
    refetchInterval: 15_000,
  })
  const sub = useReadContract({
    address: VRF.coordinator,
    abi: subAbi,
    functionName: 'getSubscription',
    args: [SUB_ID ?? 0n],
    query: { enabled: mode === 'subscription' && SUB_ID !== undefined, refetchInterval: 15_000 },
  })

  const gas = callbackGas(game, numWords).toLocaleString('en')

  if (mode === 'direct') {
    return (
      <p className="text-sm text-muted">
        You pay the wrapper{' '}
        <strong className="font-semibold text-ink">{quote.data ? usdc(quote.data.fee) : '…'}</strong> with this play
        ({numWords} word{numWords > 1 ? 's' : ''}, {gas} callback gas). Quoted at your fee cap; the contract refunds any change.
      </p>
    )
  }

  const consumers = sub.data?.[4] ?? []
  const added = PLAYGROUND.subscription && consumers.some((c) => c.toLowerCase() === PLAYGROUND.subscription!.toLowerCase())
  return (
    <p className="text-sm text-muted">
      Subscription {SUB_ID !== undefined ? <span className="hex">#{SUB_ID.toString().slice(0, 8)}…</span> : '(not set)'} pays
      on fulfilment, so you only pay gas. Balance{' '}
      <strong className="font-semibold text-ink">{sub.data ? usdc(sub.data[1]) : '…'}</strong>
      {sub.data && ` after ${sub.data[2]} answered requests`}.{' '}
      {sub.data && !added && (
        <span className="text-fail">
          The playground{' '}
          <a className="underline" href={explorerAddress(PLAYGROUND.subscription ?? '')} target="_blank" rel="noreferrer">
            contract
          </a>{' '}
          is not a consumer yet: add it on the{' '}
          <a className="underline" href="https://arcvrf.007575.xyz/subscriptions" target="_blank" rel="noreferrer">
            subscriptions page
          </a>
          .
        </span>
      )}
    </p>
  )
}
