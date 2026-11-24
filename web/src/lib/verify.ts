import {
  decodeFunctionData,
  encodeAbiParameters,
  encodePacked,
  isAddressEqual,
  keccak256,
  parseAbi,
  parseEventLogs,
  toBytes,
  toHex,
  type Hex,
} from 'viem'
import { getPublicClient } from 'wagmi/actions'
import { playgroundAbi } from '../abi'
import { VRF, wagmiConfig } from './config'
import { derive } from './games'
import type { Round } from './play'

// Arc VRF coordinator ABI fragments (same shapes as Chainlink VRF v2.5).
const PROOF = '(uint256[2] pk, uint256[2] gamma, uint256 c, uint256 s, uint256 seed, address uWitness, uint256[2] cGammaWitness, uint256[2] sHashWitness, uint256 zInv)'
const RC = '(uint64 blockNum, uint256 subId, uint32 callbackGasLimit, uint32 numWords, address sender, bytes extraArgs)'
const coordinatorAbi = parseAbi([
  'event RandomWordsRequested(bytes32 indexed keyHash, uint256 requestId, uint256 preSeed, uint256 indexed subId, uint16 minimumRequestConfirmations, uint32 callbackGasLimit, uint32 numWords, bytes extraArgs, address indexed sender)',
  'event RandomWordsFulfilled(uint256 indexed requestId, uint256 outputSeed, uint256 indexed subId, uint96 payment, bool nativePayment, bool success, bool onlyPremium)',
  `function fulfillRandomWords(${PROOF} proof, ${RC} rc, bool onlyPremium)`,
])
const batchAbi = parseAbi([`function fulfillRandomWords(${PROOF}[] proofs, ${RC}[] rcs)`])

export type Check = { title: string; detail: string; values: { label: string; value: string }[]; ok: boolean | null }

const u256 = (types: string[], vals: unknown[]) =>
  keccak256(encodeAbiParameters(types.map((type) => ({ type })), vals))
const h = (n: bigint) => toHex(n, { size: 32 })

/** Rebuild the whole derivation from chain data and check every link. Nothing here trusts the playground UI. */
export async function verifyRound(round: Round): Promise<Check[]> {
  const client = getPublicClient(wagmiConfig)!
  const checks: Check[] = []
  const id = round.requestId!

  // 1. The request: coordinator event in the request transaction.
  const reqReceipt = await client.getTransactionReceipt({ hash: round.requestTx! })
  const req = parseEventLogs({ abi: coordinatorAbi, logs: reqReceipt.logs, eventName: 'RandomWordsRequested' }).find(
    (l) => l.args.requestId === id,
  )
  if (!req) throw new Error('No RandomWordsRequested event in the request transaction')
  const { preSeed, keyHash, sender, numWords } = req.args
  const expectedSender = round.mode === 'direct' ? VRF.wrapper : round.contract
  checks.push({
    title: 'Request recorded by the coordinator',
    detail: `The coordinator logged the request with the official key hash. In ${round.mode === 'direct' ? 'direct funding the wrapper' : 'subscription mode the playground'} is the sender. The pre-seed is keccak256(keyHash, sender, subId, nonce): fixed by the request, not by the node.`,
    values: [
      { label: 'preSeed', value: h(preSeed) },
      { label: 'keyHash', value: keyHash },
      { label: 'sender', value: sender },
      { label: 'numWords', value: String(numWords) },
    ],
    ok: keyHash.toLowerCase() === VRF.keyHash && isAddressEqual(sender, expectedSender),
  })

  // 2. The request id is a hash of the pre-seed, so the id itself commits to it.
  const idCheck = BigInt(u256(['bytes32', 'uint256'], [keyHash, preSeed]))
  checks.push({
    title: 'Request id commits to the pre-seed',
    detail: 'requestId = keccak256(keyHash, preSeed). The node must answer this exact seed to fulfil this id.',
    values: [{ label: 'recomputed id', value: h(idCheck) }],
    ok: idCheck === id,
  })

  // 3. Mix in the request block hash, unknown to everyone until the block existed.
  const block = await client.getBlock({ blockNumber: reqReceipt.blockNumber })
  const seed = BigInt(keccak256(encodePacked(['uint256', 'bytes32'], [preSeed, block.hash])))
  checks.push({
    title: 'Seed mixes in the request block hash',
    detail: `seed = keccak256(preSeed ‖ blockhash(${reqReceipt.blockNumber})). Neither you, the playground, nor the node could pick this block hash.`,
    values: [
      { label: 'block hash', value: block.hash },
      { label: 'seed', value: h(seed) },
    ],
    ok: true,
  })

  // 4. The fulfilment: proof in calldata, output in the coordinator event.
  if (!round.fulfillTx) throw new Error('Fulfilment transaction not found yet')
  const [fulReceipt, fulTx] = await Promise.all([
    client.getTransactionReceipt({ hash: round.fulfillTx }),
    client.getTransaction({ hash: round.fulfillTx }),
  ])
  const ful = parseEventLogs({ abi: coordinatorAbi, logs: fulReceipt.logs, eventName: 'RandomWordsFulfilled' }).find(
    (l) => l.args.requestId === id,
  )
  if (!ful) throw new Error('No RandomWordsFulfilled event in the fulfilment transaction')
  const randomness = ful.args.outputSeed

  let proof: { pk: readonly [bigint, bigint]; gamma: readonly [bigint, bigint]; seed: bigint } | undefined
  let rcBlock: bigint | undefined
  try {
    const single = decodeFunctionData({ abi: coordinatorAbi, data: fulTx.input })
    proof = single.args[0]
    rcBlock = single.args[1].blockNum
  } catch {
    const batch = decodeFunctionData({ abi: batchAbi, data: fulTx.input })
    const i = batch.args[0].findIndex((p) => p.seed === preSeed)
    if (i >= 0) {
      proof = batch.args[0][i]
      rcBlock = batch.args[1][i].blockNum
    }
  }
  if (!proof) throw new Error('Could not find this request’s proof in the fulfilment calldata')

  const keyFromProof = u256(['uint256[2]'], [proof.pk])
  const outputFromGamma = BigInt(u256(['uint256', 'uint256[2]'], [3n, proof.gamma]))
  checks.push({
    title: 'Proof is bound to the registered key',
    detail: `The node sent a VRF proof, not a bare number. Its public key hashes to the key hash registered on the coordinator, and the proof names this request's pre-seed and block. VRF.sol checked the elliptic-curve proof on-chain: the fulfilment transaction ${fulReceipt.status === 'success' ? 'succeeded, so the proof passed' : 'failed'}.`,
    values: [
      { label: 'keccak256(pk)', value: keyFromProof },
      { label: 'γ.x', value: h(proof.gamma[0]) },
      { label: 'γ.y', value: h(proof.gamma[1]) },
      { label: 'tx to', value: fulTx.to ?? '' },
    ],
    ok:
      keyFromProof.toLowerCase() === VRF.keyHash &&
      proof.seed === preSeed &&
      rcBlock === reqReceipt.blockNumber &&
      fulReceipt.status === 'success',
  })

  checks.push({
    title: 'Randomness comes from γ',
    detail: 'randomness = keccak256(3, γ). Only the node’s secret key produces this γ for this seed, so the output was decided the moment the seed existed.',
    values: [
      { label: 'recomputed', value: h(outputFromGamma) },
      { label: 'coordinator event', value: h(randomness) },
    ],
    ok: outputFromGamma === randomness && ful.args.success,
  })

  // 5. Expand into words, exactly like the coordinator.
  const words = Array.from({ length: Number(numWords) }, (_, i) => BigInt(u256(['uint256', 'uint256'], [randomness, BigInt(i)])))
  const delivered = round.words ?? []
  checks.push({
    title: 'Words expand from the randomness',
    detail: 'words[i] = keccak256(randomness, i). Recomputed here and compared with the words stored in the playground.',
    values: words.map((w, i) => ({ label: `word ${i}`, value: h(w) })),
    ok: words.length === delivered.length && words.every((w, i) => w === delivered[i]),
  })

  // 6. Game result: the contract's view against the math run in this browser.
  const onchain = await client.readContract({ address: round.contract, abi: playgroundAbi, functionName: 'resultOf', args: [id] })
  const local = derive(round.game, round.a, round.b, words, round.names)
  const values = [
    { label: 'contract resultOf', value: onchain.join(', ') },
    { label: 'recomputed here', value: local.result.join(', ') },
  ]
  let ok = onchain.length === local.result.length && onchain.every((v, i) => v === local.result[i])
  if (round.game === 'Raffle' && round.names) {
    const r = await client.readContract({ address: round.contract, abi: playgroundAbi, functionName: 'getRequest', args: [id] })
    const listHash = keccak256(toBytes(round.names.join('\n')))
    values.push({ label: 'entry list hash', value: listHash }, { label: 'committed on-chain', value: r.commit })
    ok = ok && listHash === (r.commit as Hex)
  }
  checks.push({
    title: 'Result follows from the words',
    detail: 'The game result is a pure function of the words and the inputs you locked in before the request.',
    values,
    ok,
  })

  return checks
}
