import { useCallback, useState } from 'react'
import { parseEventLogs, BaseError, type Address, type Hash } from 'viem'
import { estimateFeesPerGas, getPublicClient, readContract, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import { playgroundAbi } from '../abi'
import { MIN_MAX_FEE, PLAYGROUND, wagmiConfig, type Mode } from './config'
import { gameIndex, type GameName } from './games'

type GameFn = 'requestNumber' | 'rollDice' | 'flipCoin' | 'playHiLo' | 'drawWinners'

export type Status = 'signing' | 'requested' | 'settled' | 'failed'

export type Round = {
  key: number
  mode: Mode
  contract: Address
  game: GameName
  a: bigint
  b: bigint
  names?: string[]
  status: Status
  error?: string
  requestId?: bigint
  requestTx?: Hash
  requestBlock?: bigint
  fee?: bigint
  words?: readonly bigint[]
  fulfillTx?: Hash
  startedAt: number
  settledAt?: number
}

export type PlayArgs = { game: GameName; fn: GameFn; args: readonly unknown[]; numWords: number; a: bigint; b: bigint; names?: string[] }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function errorText(e: unknown) {
  if (e instanceof BaseError) return e.shortMessage
  return e instanceof Error ? e.message : String(e)
}

/** Quote the direct-funding fee at the fee cap we will send with. The wrapper prices at tx.gasprice,
 * which is never above maxFeePerGas, so paying the quote at the cap always covers it; change is refunded. */
export async function quoteDirect(game: GameName, numWords: number) {
  const contract = PLAYGROUND.direct
  if (!contract) return undefined
  const { maxFeePerGas } = await estimateFeesPerGas(wagmiConfig)
  const cap = maxFeePerGas > MIN_MAX_FEE ? maxFeePerGas : MIN_MAX_FEE
  const fee = await readContract(wagmiConfig, {
    address: contract,
    abi: playgroundAbi,
    functionName: 'quote',
    args: [gameIndex(game), numWords, cap],
  })
  return { fee, maxFeePerGas: cap }
}

export function useRounds() {
  const [rounds, setRounds] = useState<Round[]>([])
  const patch = (key: number, p: Partial<Round>) => setRounds((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))

  const play = useCallback(async (mode: Mode, p: PlayArgs) => {
    const contract = PLAYGROUND[mode]
    if (!contract) return
    const key = Date.now()
    setRounds((rs) => [{ key, mode, contract, game: p.game, a: p.a, b: p.b, names: p.names, status: 'signing', startedAt: key }, ...rs])
    try {
      // 1. Pay (direct) or not (subscription), and send the request.
      let value = 0n
      let maxFeePerGas: bigint | undefined
      if (mode === 'direct') {
        const q = await quoteDirect(p.game, p.numWords)
        if (!q) throw new Error('Direct playground address missing')
        value = q.fee
        maxFeePerGas = q.maxFeePerGas
      }
      const hash = await writeContract(wagmiConfig, {
        address: contract,
        abi: playgroundAbi,
        // The union of game functions is checked by the contract ABI at runtime; args shapes come from each game form.
        functionName: p.fn as 'flipCoin',
        args: p.args as [boolean],
        value,
        maxFeePerGas,
      })
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash })
      if (receipt.status !== 'success') throw new Error('Request transaction reverted')
      const [ev] = parseEventLogs({ abi: playgroundAbi, logs: receipt.logs, eventName: 'Requested' })
      const requestId = ev.args.requestId
      patch(key, { status: 'requested', requestId, requestTx: hash, requestBlock: receipt.blockNumber, fee: value })

      // 2. Wait for the Arc VRF node. The answer arrives in a separate transaction, usually within seconds.
      const client = getPublicClient(wagmiConfig)!
      for (let i = 0; ; i++) {
        const r = await client.readContract({ address: contract, abi: playgroundAbi, functionName: 'getRequest', args: [requestId] })
        if (r.settled) {
          const logs = await client.getContractEvents({
            address: contract,
            abi: playgroundAbi,
            eventName: 'Settled',
            args: { requestId },
            fromBlock: receipt.blockNumber,
          })
          patch(key, { status: 'settled', words: r.words, fulfillTx: logs[0]?.transactionHash, settledAt: Date.now() })
          return
        }
        // Never re-request: a slow answer is still coming. Just keep waiting.
        await sleep(i < 15 ? 2000 : 6000)
      }
    } catch (e) {
      patch(key, { status: 'failed', error: errorText(e) })
    }
  }, [])

  return { rounds, play }
}
