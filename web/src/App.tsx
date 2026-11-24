import { useState } from 'react'
import { useAccount } from 'wagmi'
import { CoinGame, DiceGame, HiLoGame, NumberGame, RaffleGame } from './components/Games'
import { HowItWorks } from './components/HowItWorks'
import { Receipt } from './components/Receipt'
import { Wallet } from './components/Wallet'
import { arcTestnet, PLAYGROUND, type Mode } from './lib/config'
import type { GameName } from './lib/games'
import { useRounds } from './lib/play'

const TABS: { id: GameName | 'How'; label: string }[] = [
  { id: 'Number', label: 'Number' },
  { id: 'Dice', label: 'Dice' },
  { id: 'Coin', label: 'Coin flip' },
  { id: 'HiLo', label: 'Higher or lower' },
  { id: 'Raffle', label: 'Raffle' },
  { id: 'How', label: 'How it works' },
]

const GAME_VIEW = { Number: NumberGame, Dice: DiceGame, Coin: CoinGame, HiLo: HiLoGame, Raffle: RaffleGame }

export function App() {
  const [tab, setTab] = useState<GameName | 'How'>('Dice')
  const [mode, setMode] = useState<Mode>('direct')
  const { rounds, play } = useRounds()
  const { isConnected, chainId } = useAccount()

  const deployed = !!PLAYGROUND[mode]
  const ready = deployed && isConnected && chainId === arcTestnet.id
  const mine = tab === 'How' ? [] : rounds.filter((r) => r.game === tab)
  const View = tab === 'How' ? undefined : GAME_VIEW[tab]

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Arc VRF Playground</h1>
          <p className="text-sm text-muted">Provably fair randomness on Arc Testnet, one game at a time.</p>
        </div>
        <Wallet />
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-rule py-3">
        <span className="text-sm text-muted">Who pays for randomness</span>
        <div role="radiogroup" className="inline-flex rounded-full bg-paper p-1">
          {(['direct', 'subscription'] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${mode === m ? 'bg-cobalt text-paper' : 'text-muted hover:text-ink'}`}
            >
              {m === 'direct' ? 'Player, per request' : 'App subscription'}
            </button>
          ))}
        </div>
      </div>

      <nav className="-mx-4 mt-6 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Games">
        {TABS.map((t) => (
          <button
            key={t.id}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 font-semibold ${tab === t.id ? 'bg-ink text-ground' : 'text-muted hover:bg-paper hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'How' ? (
        <HowItWorks />
      ) : (
        <main className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <div>
            {!deployed && (
              <p className="mb-6 rounded-xl border border-wait p-4 text-sm">
                The {mode === 'direct' ? 'direct-funding' : 'subscription'} playground address is not set. Deploy the contracts in{' '}
                <code className="hex">contracts/</code> and put the printed addresses in <code className="hex">web/.env</code>, then restart the dev server.
              </p>
            )}
            {deployed && !isConnected && <p className="mb-6 text-sm text-muted">Connect a wallet with some Arc Testnet USDC to play.</p>}
            {View && <View mode={mode} play={(p) => play(mode, p)} disabled={!ready} />}
          </div>
          <div className="space-y-6">
            {mine.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-rule p-8 text-muted">
                <p className="text-lg font-semibold text-ink">Your result lands here</p>
                <p className="mt-1">Each play shows the random words, the math that turned them into your result, and a button that checks the whole chain of evidence against Arc Testnet.</p>
              </div>
            ) : (
              mine.map((r) => <Receipt key={r.key} round={r} />)
            )}
          </div>
        </main>
      )}
    </div>
  )
}
