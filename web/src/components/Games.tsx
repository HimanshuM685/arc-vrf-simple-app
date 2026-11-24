import { useState } from 'react'
import { keccak256, toBytes } from 'viem'
import { useAccount, useBlockNumber, useReadContract, useWriteContract } from 'wagmi'
import { playgroundAbi } from '../abi'
import { PLAYGROUND, type Mode } from '../lib/config'
import { CARD, type GameName } from '../lib/games'
import { errorText, type PlayArgs } from '../lib/play'
import { Funding } from './Funding'
import { Card } from './Receipt'

type Props = { mode: Mode; play: (p: PlayArgs) => void; disabled: boolean }

const btn = 'rounded-full bg-ink px-6 py-3 text-lg font-semibold text-ground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40'
const field = 'mt-1 w-full rounded-lg border border-rule bg-paper px-3 py-2 text-lg tabular-nums focus:border-ink'

function Shell({ title, intro, mode, game, numWords, children }: { title: string; intro: string; mode: Mode; game: GameName; numWords: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-4xl font-extrabold tracking-tight">{title}</h2>
      <p className="mt-2 max-w-prose text-muted">{intro}</p>
      <div className="mt-6 space-y-5">{children}</div>
      <div className="mt-5 max-w-prose"><Funding mode={mode} game={game} numWords={numWords} /></div>
    </section>
  )
}

export function NumberGame({ mode, play, disabled }: Props) {
  const [min, setMin] = useState('1')
  const [max, setMax] = useState('100')
  const ok = /^\d+$/.test(min) && /^\d+$/.test(max) && BigInt(max) >= BigInt(min) && BigInt(max) < 2n ** 64n
  return (
    <Shell mode={mode} game="Number" numWords={1} title="Random number" intro="Pick any range. One random word comes back and is folded into your range with a modulo. Your range is stored before the request, so it cannot be changed to suit the answer.">
      <div className="grid max-w-sm grid-cols-2 gap-4">
        <label className="text-sm text-muted">From<input className={field} inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.trim())} /></label>
        <label className="text-sm text-muted">To<input className={field} inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.trim())} /></label>
      </div>
      {!ok && <p className="text-sm text-fail">Use whole numbers with “To” at least “From”.</p>}
      <button className={btn} disabled={disabled || !ok} onClick={() => play({ game: 'Number', fn: 'requestNumber', args: [BigInt(min), BigInt(max)], numWords: 1, a: BigInt(min), b: BigInt(max) })}>
        Draw a number
      </button>
    </Shell>
  )
}

const SIDES = [4, 6, 8, 10, 12, 20, 100]

export function DiceGame({ mode, play, disabled }: Props) {
  const [count, setCount] = useState(2)
  const [sides, setSides] = useState(6)
  return (
    <Shell mode={mode} game="Dice" numWords={count} title="Dice" intro="Each die gets its own random word, so rolling three dice asks Arc VRF for three words in one request. Direct funding allows up to ten words per request.">
      <div className="flex flex-wrap gap-6">
        <fieldset>
          <legend className="text-sm text-muted">Dice</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} aria-pressed={count === n} onClick={() => setCount(n)} className={`size-10 rounded-lg border text-lg font-semibold ${count === n ? 'border-ink bg-ink text-ground' : 'border-rule bg-paper'}`}>{n}</button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm text-muted">Sides</legend>
          <div className="mt-1 flex flex-wrap gap-1">
            {SIDES.map((s) => (
              <button key={s} aria-pressed={sides === s} onClick={() => setSides(s)} className={`h-10 rounded-lg border px-3 text-lg font-semibold ${sides === s ? 'border-ink bg-ink text-ground' : 'border-rule bg-paper'}`}>d{s}</button>
            ))}
          </div>
        </fieldset>
      </div>
      <button className={btn} disabled={disabled} onClick={() => play({ game: 'Dice', fn: 'rollDice', args: [BigInt(count), BigInt(sides)], numWords: count, a: BigInt(count), b: BigInt(sides) })}>
        Roll {count}d{sides}
      </button>
    </Shell>
  )
}

export function CoinGame({ mode, play, disabled }: Props) {
  const stats = usePlayer(mode)
  const go = (heads: boolean) => play({ game: 'Coin', fn: 'flipCoin', args: [heads], numWords: 1, a: heads ? 1n : 0n, b: 0n })
  return (
    <Shell mode={mode} game="Coin" numWords={1} title="Coin flip" intro="Call it first. Your call is written on-chain with the request, then an even word lands heads and an odd word lands tails.">
      <div className="flex flex-wrap gap-3">
        <button className={btn} disabled={disabled} onClick={() => go(true)}>Call heads</button>
        <button className={btn} disabled={disabled} onClick={() => go(false)}>Call tails</button>
      </div>
      {stats && stats.coinFlips > 0n && (
        <p className="text-muted">You have called {stats.coinWins.toString()} of {stats.coinFlips.toString()} flips correctly on this contract.</p>
      )}
    </Shell>
  )
}

export function HiLoGame({ mode, play, disabled }: Props) {
  const stats = usePlayer(mode)
  const card = stats && stats.hiloCard > 0 ? stats.hiloCard : 7
  const pending = stats?.hiloPending ?? false
  const go = (higher: boolean) => play({ game: 'HiLo', fn: 'playHiLo', args: [higher], numWords: 1, a: higher ? 1n : 0n, b: BigInt(card) })
  return (
    <Shell mode={mode} game="HiLo" numWords={1} title="Higher or lower" intro="Your current card is stored on-chain. Guess whether the next card from A to K is higher or lower. Your card stays locked until the answer lands, so you cannot open a second round to fish for a better draw.">
      <div className="flex items-center gap-5">
        <Card rank={card} />
        <div className="text-muted">
          <p>Your card is <strong className="text-ink">{CARD[card]}</strong></p>
          {stats && <p>Streak {stats.hiloStreak}, best {stats.hiloBest}</p>}
        </div>
      </div>
      {pending && (
        <div className="space-y-2">
          <p className="text-wait">A round is still waiting for its answer. New rounds unlock when it lands.</p>
          <AbandonHiLo mode={mode} />
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button className={btn} disabled={disabled || pending || card === 13} onClick={() => go(true)}>Higher</button>
        <button className={btn} disabled={disabled || pending || card === 1} onClick={() => go(false)}>Lower</button>
      </div>
    </Shell>
  )
}

export function RaffleGame({ mode, play, disabled }: Props) {
  const [text, setText] = useState('Ada\nGrace\nAlan\nKatherine\nLinus\nMargaret\nDennis\nBarbara')
  const [winners, setWinners] = useState(2)
  const names = text.split('\n').map((s) => s.trim()).filter(Boolean)
  const hash = keccak256(toBytes(names.join('\n')))
  const ok = names.length > 0 && names.length <= 1000 && winners <= names.length
  return (
    <Shell mode={mode} game="Raffle" numWords={1} title="Raffle draw" intro="Paste the entries, one per line. The list stays in your browser; only its hash and size go on-chain with the request. Anyone holding the same list can check it was not edited after the draw.">
      <label className="block max-w-md text-sm text-muted">
        Entries ({names.length})
        <textarea className={`${field} h-48 font-mono text-base`} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="block max-w-40 text-sm text-muted">
        Winners
        <input className={field} type="number" min={1} max={Math.min(20, names.length)} value={winners} onChange={(e) => setWinners(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} />
      </label>
      <p className="text-sm text-muted">List hash <span className="hex text-ink">{hash}</span></p>
      {!ok && <p className="text-sm text-fail">Add between 1 and 1000 entries, and no more winners than entries.</p>}
      <button className={btn} disabled={disabled || !ok} onClick={() => play({ game: 'Raffle', fn: 'drawWinners', args: [BigInt(names.length), BigInt(winners), hash], numWords: 1, a: BigInt(names.length), b: BigInt(winners), names })}>
        Draw {winners} winner{winners > 1 ? 's' : ''}
      </button>
    </Shell>
  )
}

/** Mirrors PlaygroundGames.HILO_TIMEOUT_BLOCKS. */
const HILO_TIMEOUT_BLOCKS = 7200n

/** Escape hatch for a round whose answer never lands (failed callback, cancelled subscription). */
function AbandonHiLo({ mode }: { mode: Mode }) {
  const { address } = useAccount()
  const { data: round } = useReadContract({
    address: PLAYGROUND[mode],
    abi: playgroundAbi,
    functionName: 'hiloRounds',
    args: [address!],
    query: { enabled: !!address && !!PLAYGROUND[mode], refetchInterval: 10_000 },
  })
  const { data: block } = useBlockNumber({ query: { refetchInterval: 10_000 } })
  const { writeContract, isPending, error } = useWriteContract()
  const unlockAt = round ? round[1] + HILO_TIMEOUT_BLOCKS : undefined
  const ready = unlockAt !== undefined && block !== undefined && block >= unlockAt
  return (
    <div className="text-sm text-muted">
      <button
        className="rounded-full border border-rule px-4 py-1.5 font-semibold hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!ready || isPending}
        onClick={() => writeContract({ address: PLAYGROUND[mode]!, abi: playgroundAbi, functionName: 'abandonHiLo' })}
      >
        Give up this round
      </button>
      <span className="ml-3">
        {ready ? 'Your card and streak stay as they are.' : 'Available if no answer comes within about an hour.'}
      </span>
      {error && <p className="mt-1 text-fail">{errorText(error)}</p>}
    </div>
  )
}

function usePlayer(mode: Mode) {
  const { address } = useAccount()
  const { data } = useReadContract({
    address: PLAYGROUND[mode],
    abi: playgroundAbi,
    functionName: 'players',
    args: [address!],
    query: { enabled: !!address && !!PLAYGROUND[mode], refetchInterval: 4000 },
  })
  if (!data) return undefined
  const [plays, coinFlips, coinWins, hiloCard, hiloStreak, hiloBest, hiloPending] = data
  return { plays, coinFlips, coinWins, hiloCard, hiloStreak, hiloBest, hiloPending }
}
