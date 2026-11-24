import { useEffect, useState } from 'react'
import { formatEther } from 'viem'
import { explorerTx, short, vrfRequestPage } from '../lib/config'
import { CARD, derive } from '../lib/games'
import type { Round } from '../lib/play'
import { verifyRound, type Check } from '../lib/verify'
import { errorText } from '../lib/play'

function Elapsed({ from, to }: { from: number; to?: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (to) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [to])
  return <>{(((to ?? now) - from) / 1000).toFixed(1)}s</>
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }

function Die({ face, sides }: { face: number; sides: number }) {
  if (sides === 6) {
    return (
      <span className="land grid size-16 grid-cols-3 grid-rows-3 gap-1 rounded-xl border-2 border-ink bg-paper p-2" aria-label={`Die showing ${face}`}>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className={PIPS[face].includes(i) ? 'rounded-full bg-ink' : ''} />
        ))}
      </span>
    )
  }
  return (
    <span className="land flex size-16 items-center justify-center rounded-xl border-2 border-ink bg-paper text-2xl font-bold tabular-nums">
      {face}
    </span>
  )
}

function Outcome({ round }: { round: Round }) {
  const d = derive(round.game, round.a, round.b, round.words!, round.names)
  const r = d.result.map(Number)
  switch (round.game) {
    case 'Number':
      return <p className="land text-[clamp(3.5rem,12vw,7rem)] leading-none font-extrabold tracking-tight tabular-nums">{d.result[0].toString()}</p>
    case 'Dice':
      return (
        <div>
          <div className="flex flex-wrap gap-3">{r.map((f, i) => <Die key={i} face={f} sides={Number(round.b)} />)}</div>
          {r.length > 1 && <p className="mt-3 text-lg">Total {r.reduce((x, y) => x + y, 0)}</p>}
        </div>
      )
    case 'Coin':
      return (
        <div className="flex items-center gap-5">
          <span className={`land flex size-28 items-center justify-center rounded-full border-4 text-2xl font-extrabold ${r[0] ? 'border-cobalt bg-cobalt-soft text-cobalt' : 'border-ink bg-paper'}`}>
            {r[0] ? 'Heads' : 'Tails'}
          </span>
          <p className={`text-2xl font-bold ${r[1] ? 'text-pass' : 'text-fail'}`}>{r[1] ? 'You called it' : 'Not this time'}</p>
        </div>
      )
    case 'HiLo':
      return (
        <div className="flex items-center gap-4">
          <Card rank={r[0]} dim />
          <span className="text-muted">{round.a === 1n ? 'higher?' : 'lower?'}</span>
          <Card rank={r[1]} />
          <p className={`ml-2 text-2xl font-bold ${r[2] === 1 ? 'text-pass' : r[2] === 0 ? 'text-fail' : 'text-wait'}`}>
            {r[2] === 1 ? 'Win' : r[2] === 0 ? 'Lose' : 'Tie, streak kept'}
          </p>
        </div>
      )
    case 'Raffle':
      return (
        <ol className="land list-decimal space-y-1 pl-6 text-xl font-semibold marker:text-muted">
          {r.map((w, i) => <li key={i}>{round.names?.[w] ?? `Entry #${w}`}</li>)}
        </ol>
      )
  }
}

export function Card({ rank, dim }: { rank: number; dim?: boolean }) {
  return (
    <span className={`land flex h-24 w-16 items-center justify-center rounded-lg border-2 text-3xl font-extrabold ${dim ? 'border-rule bg-ground text-muted' : 'border-ink bg-paper'}`}>
      {CARD[rank]}
    </span>
  )
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="underline decoration-rule underline-offset-4 hover:decoration-ink" href={href} target="_blank" rel="noreferrer">{children}</a>
}

export function Receipt({ round }: { round: Round }) {
  const [checks, setChecks] = useState<Check[]>()
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string>()

  const runVerify = async () => {
    setVerifying(true)
    setVerifyError(undefined)
    try {
      setChecks(await verifyRound(round))
    } catch (e) {
      setVerifyError(errorText(e))
    } finally {
      setVerifying(false)
    }
  }

  const status = {
    signing: 'Confirm in your wallet',
    requested: 'Waiting for the Arc VRF node to answer',
    settled: 'Answered',
    failed: 'Failed',
  }[round.status]

  return (
    <article className="overflow-hidden rounded-2xl bg-paper shadow-[0_1px_0_var(--color-rule)]">
      <div className="p-6">
        <p className={`text-sm font-semibold ${round.status === 'failed' ? 'text-fail' : round.status === 'settled' ? 'text-pass' : 'text-wait'}`}>
          <span className={round.status === 'requested' ? 'breathe' : ''}>{status}</span>
          <span className="ml-2 font-normal text-muted">
            <Elapsed from={round.startedAt} to={round.settledAt ?? (round.status === 'failed' ? round.startedAt : undefined)} />
          </span>
        </p>
        <div className="mt-4 min-h-20">
          {round.status === 'settled' && round.words ? (
            <Outcome round={round} />
          ) : round.status === 'failed' ? (
            <p className="text-fail">{round.error}</p>
          ) : (
            <p className="breathe text-6xl font-extrabold text-rule">?</p>
          )}
        </div>
        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {round.requestId !== undefined && (
            <>
              <dt className="text-muted">Request id</dt>
              <dd className="hex"><Link href={vrfRequestPage(round.requestId)}>{short(round.requestId.toString(), 10)}</Link></dd>
            </>
          )}
          {round.requestTx && (
            <>
              <dt className="text-muted">Request tx</dt>
              <dd className="hex"><Link href={explorerTx(round.requestTx)}>{short(round.requestTx)}</Link></dd>
            </>
          )}
          {round.fulfillTx && (
            <>
              <dt className="text-muted">Answer tx</dt>
              <dd className="hex"><Link href={explorerTx(round.fulfillTx)}>{short(round.fulfillTx)}</Link></dd>
            </>
          )}
          {round.fee !== undefined && (
            <>
              <dt className="text-muted">Paid</dt>
              <dd>{round.mode === 'direct' ? `${Number(formatEther(round.fee)).toFixed(4)} USDC to the wrapper (change refunded)` : 'Gas only; subscription billed on answer'}</dd>
            </>
          )}
        </dl>
      </div>

      {round.status === 'settled' && round.words && (
        <>
          <div className="perforation" aria-hidden="true" />
          <div className="bg-cobalt-soft/50 p-6">
            <h3 className="font-bold">How this result was made</h3>
            <ul className="mt-3 space-y-2">
              {derive(round.game, round.a, round.b, round.words, round.names).lines.map((l, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="hex text-muted">{l.formula}</span>
                  <span className="font-semibold">{l.value}</span>
                </li>
              ))}
            </ul>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted hover:text-ink">Raw random words</summary>
              {round.words.map((w, i) => <p key={i} className="hex mt-1">{`0x${w.toString(16).padStart(64, '0')}`}</p>)}
            </details>

            {!checks && (
              <button
                className="mt-5 rounded-full bg-cobalt px-5 py-2 font-semibold text-paper hover:opacity-90 disabled:opacity-60"
                onClick={runVerify}
                disabled={verifying}
              >
                {verifying ? 'Checking the chain…' : 'Verify on-chain'}
              </button>
            )}
            {verifyError && <p className="mt-3 text-sm text-fail">Verification stopped: {verifyError}</p>}
            {checks && (
              <ol className="mt-5 space-y-4">
                {checks.map((c, i) => (
                  <li key={c.title} className="grid grid-cols-[2rem_1fr] gap-x-3">
                    <span className={`flex size-7 items-center justify-center rounded-full text-sm font-bold text-paper ${c.ok ? 'bg-pass' : 'bg-fail'}`} aria-label={c.ok ? 'passed' : 'failed'}>
                      {c.ok ? '✓' : i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold">{c.title}</p>
                      <p className="mt-0.5 text-sm text-muted">{c.detail}</p>
                      {c.values.map((v) => (
                        <p key={v.label} className="mt-1 text-sm">
                          <span className="text-muted">{v.label} </span>
                          <span className="hex">{v.value}</span>
                        </p>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </article>
  )
}
