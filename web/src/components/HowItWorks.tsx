import { VRF, explorerAddress } from '../lib/config'

const FLOW = [
  {
    name: 'You ask',
    who: 'Your contract',
    text: 'The playground stores your inputs (range, dice, guess, list hash), then calls the coordinator. The coordinator derives a pre-seed from the key hash, the caller, the subscription and a counter, and logs the request.',
    formula: 'preSeed = keccak256(keyHash, sender, subId, nonce)',
  },
  {
    name: 'The block seals it',
    who: 'Arc',
    text: 'The request lands in a block. Nobody knew that block’s hash in advance, so nobody could steer the seed.',
    formula: 'seed = keccak256(preSeed ‖ blockhash(requestBlock))',
  },
  {
    name: 'The node proves',
    who: 'Arc VRF node',
    text: 'The node runs the seed through its secret key to get a curve point γ, plus a proof that it used the key registered on-chain. With a given key and seed there is exactly one valid γ.',
    formula: 'γ = sk · hashToCurve(pk, seed)',
  },
  {
    name: 'The chain checks',
    who: 'Coordinator',
    text: 'VRF.sol verifies the proof inside the fulfilment transaction. A made-up or tampered value fails and the transaction reverts.',
    formula: 'randomness = keccak256(3, γ)',
  },
  {
    name: 'Your contract receives',
    who: 'Playground',
    text: 'One proof expands into as many words as you asked for. The playground stores them and turns them into your result with plain arithmetic anyone can redo.',
    formula: 'words[i] = keccak256(randomness, i)',
  },
]

const RULES = [
  ['Inputs lock before the request', 'Every choice that affects the outcome is written on-chain in the same transaction that asks for randomness. Hi-lo goes further: your card stays locked until the answer arrives, so you cannot open a second round and keep only the good one.'],
  ['One request, one answer', 'A request id is answered once. If an answer is slow, the playground keeps waiting instead of asking again: re-requesting would let someone discard results they dislike.'],
  ['The callback cannot fail', 'fulfillRandomWords only stores words and bumps counters. It makes no external calls and cannot revert, because a reverted callback is not retried and is still charged.'],
  ['Results are public math', 'resultOf and winnersOf are pure functions of the stored words. The Verify button recomputes everything in your browser from raw chain data.'],
  ['The operator can delay, not choose', 'Arc VRF runs on a single node. It could stall answers, but it cannot pick a different number: only one γ passes the proof for a given seed.'],
]

function Formula({ children }: { children: string }) {
  return <p className="hex mt-2 inline-block rounded-md bg-cobalt-soft px-2 py-1 text-ink">{children}</p>
}

export function HowItWorks() {
  return (
    <main className="mt-10 max-w-3xl">
      <h2 className="text-4xl font-extrabold tracking-tight">How a fair random number gets made</h2>
      <p className="mt-3 text-lg text-muted">
        Arc VRF gives contracts random numbers that come with a proof. Nobody can predict the number before the request, and nobody, including the
        operator, can swap it afterwards. It is a port of Chainlink VRF v2.5 to Arc Testnet, paid in USDC.
      </p>

      <ol className="mt-10">
        {FLOW.map((s, i) => (
          <li key={s.name} className="relative grid grid-cols-[2.5rem_1fr] gap-x-4 pb-9 last:pb-0">
            <span className="relative z-10 flex size-10 items-center justify-center rounded-full border-2 border-ink bg-paper font-bold">{i + 1}</span>
            {i < FLOW.length - 1 && <span aria-hidden="true" className="absolute top-10 bottom-0 left-5 w-0.5 -translate-x-1/2 bg-rule" />}
            <div className="pt-1.5">
              <h3 className="text-xl font-bold">
                {s.name} <span className="ml-1 text-sm font-normal text-muted">{s.who}</span>
              </h3>
              <p className="mt-1 text-muted">{s.text}</p>
              <Formula>{s.formula}</Formula>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="mt-16 text-3xl font-extrabold tracking-tight">What keeps the games fair</h2>
      <dl className="mt-6 space-y-5">
        {RULES.map(([t, d]) => (
          <div key={t}>
            <dt className="text-lg font-bold">{t}</dt>
            <dd className="mt-1 text-muted">{d}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-16 text-3xl font-extrabold tracking-tight">Two ways to pay</h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl bg-paper p-6">
          <h3 className="text-xl font-bold">Player, per request</h3>
          <p className="mt-1 text-sm text-muted">Direct funding through the wrapper</p>
          <p className="mt-3 text-muted">
            The player sends USDC with each play. PlaygroundDirect pays the wrapper the exact price for that request and refunds the change. No setup, but
            at most ten words per request.
          </p>
          <Formula>gasPrice × (callbackGas + overhead + words × perWord) × (100 + premium%) / 100 + flat fee</Formula>
        </div>
        <div className="rounded-2xl bg-paper p-6">
          <h3 className="text-xl font-bold">App subscription</h3>
          <p className="mt-1 text-sm text-muted">Billed to a funded subscription</p>
          <p className="mt-3 text-muted">
            The app owner funds a subscription and adds PlaygroundSubscription as a consumer. Players pay only gas; the coordinator charges the subscription
            for the gas each answer actually used. Up to 500 words per request.
          </p>
          <Formula>gasPrice × (gasUsed + afterPayment) × (100 + premium%) / 100 + flat fee</Formula>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">
        Either way, more words and more callback gas cost more. Arc gas is priced in USDC, with a 20 gwei floor.
      </p>

      <h2 className="mt-16 text-3xl font-extrabold tracking-tight">A note on modulo bias</h2>
      <p className="mt-3 text-muted">
        The games fold a 256-bit word into a small range with <span className="hex">word mod n</span>. Since 2²⁵⁶ is not a multiple of n, some outcomes
        are more likely by about n / 2²⁵⁶, around 10⁻⁷⁵ for a die. That is far below anything measurable, so plain modulo is the right call here.
      </p>

      <h2 className="mt-16 text-3xl font-extrabold tracking-tight">Contracts on Arc Testnet</h2>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">Coordinator</dt>
        <dd className="hex"><a className="underline underline-offset-4" href={explorerAddress(VRF.coordinator)} target="_blank" rel="noreferrer">{VRF.coordinator}</a></dd>
        <dt className="text-muted">Wrapper</dt>
        <dd className="hex"><a className="underline underline-offset-4" href={explorerAddress(VRF.wrapper)} target="_blank" rel="noreferrer">{VRF.wrapper}</a></dd>
        <dt className="text-muted">Key hash</dt>
        <dd className="hex">{VRF.keyHash}</dd>
      </dl>
      <p className="mt-6 text-sm text-muted">
        Arc VRF is unaudited testnet software. Read the full{' '}
        <a className="underline underline-offset-4" href="https://arcvrf.007575.xyz/docs" target="_blank" rel="noreferrer">Arc VRF docs</a>.
      </p>
    </main>
  )
}
