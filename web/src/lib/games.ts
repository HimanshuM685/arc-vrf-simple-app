import { encodeAbiParameters, keccak256 } from 'viem'

/** Same order as the Solidity enum PlaygroundGames.Game. */
export const GAMES = ['Number', 'Dice', 'Coin', 'HiLo', 'Raffle'] as const
export type GameName = (typeof GAMES)[number]
export const gameIndex = (g: GameName) => GAMES.indexOf(g)

export const CARD = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

/** One line per derived value: the formula as text plus its result. Mirrors PlaygroundGames.resultOf. */
export type Line = { formula: string; value: string }

export type Derived = { result: bigint[]; lines: Line[] }

const hx = (w: bigint) => `0x${w.toString(16).slice(0, 8)}…`

export function derive(game: GameName, a: bigint, b: bigint, words: readonly bigint[], names?: string[]): Derived {
  switch (game) {
    case 'Number': {
      const span = b - a + 1n
      const v = a + (words[0] % span)
      return { result: [v], lines: [{ formula: `${a} + word₀ mod ${span}`, value: v.toString() }] }
    }
    case 'Dice': {
      const faces = words.map((w) => (w % b) + 1n)
      return {
        result: faces,
        lines: faces.map((f, i) => ({ formula: `${hx(words[i])} mod ${b} + 1`, value: f.toString() })),
      }
    }
    case 'Coin': {
      const heads = words[0] % 2n === 0n
      const won = heads === (a === 1n)
      return {
        result: [heads ? 1n : 0n, won ? 1n : 0n],
        lines: [{ formula: `${hx(words[0])} mod 2 = ${words[0] % 2n} → ${heads ? 'even' : 'odd'}`, value: heads ? 'Heads' : 'Tails' }],
      }
    }
    case 'HiLo': {
      const next = (words[0] % 13n) + 1n
      const outcome = next === b ? 2n : (a === 1n) === next > b ? 1n : 0n
      return {
        result: [b, next, outcome],
        lines: [{ formula: `${hx(words[0])} mod 13 + 1`, value: `${next} (${CARD[Number(next)]})` }],
      }
    }
    case 'Raffle': {
      const winners = raffle(words[0], Number(a), Number(b))
      return {
        result: winners,
        lines: winners.map((w, i) => ({
          formula: `pick ${i + 1}: keccak256(word₀, ${i}) mod ${Number(a) - i}`,
          value: names?.[Number(w)] ?? `#${w}`,
        })),
      }
    }
  }
}

/** Partial Fisher-Yates over [0, n), identical to PlaygroundGames.winnersOf. */
export function raffle(word: bigint, n: number, k: number): bigint[] {
  const pool = Array.from({ length: n }, (_, i) => BigInt(i))
  const out: bigint[] = []
  for (let i = 0; i < k; i++) {
    const r = BigInt(keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [word, BigInt(i)])))
    const j = i + Number(r % BigInt(n - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
    out.push(pool[i])
  }
  return out
}

/** Callback gas the contract asks for (PlaygroundGames.callbackGasFor). */
export const callbackGas = (game: GameName, numWords: number) => (game === 'HiLo' ? 90_000 : 60_000) + 30_000 * numWords
