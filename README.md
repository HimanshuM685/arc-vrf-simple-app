# Arc VRF Playground

A small example dApp that shows what you can build with [Arc VRF](https://arcvrf.007575.xyz/docs), the verifiable random function on Arc Testnet. It has five games, both ways of paying for randomness, and an on-chain verifier for every result.

| Game | Words | How the result is derived |
|---|---|---|
| Random number | 1 | `min + word mod (max - min + 1)` |
| Dice (1–10 dice, d4–d100) | one per die | `word[i] mod sides + 1` |
| Coin flip | 1 | even word = heads; your call is locked in with the request |
| Higher or lower | 1 | next card `word mod 13 + 1` against your stored card; one open round per player, which you can give up if no answer lands within ~1 hour |
| Raffle | 1 | partial Fisher–Yates over the entries; only the list hash goes on-chain, before the draw |

Each result opens as a receipt that shows the random words and the math that produced the result. **Verify on-chain** then rebuilds the whole chain of evidence from raw Arc Testnet data in your browser:

1. The coordinator's `RandomWordsRequested` event: pre-seed, official key hash, and sender.
2. `requestId == keccak256(keyHash, preSeed)`.
3. `seed = keccak256(preSeed ‖ blockhash(requestBlock))`.
4. The proof in the fulfilment calldata uses the registered key and this pre-seed. `VRF.sol` checked it on-chain.
5. `randomness == keccak256(3, γ)` matches the coordinator's `RandomWordsFulfilled` event.
6. `words[i] == keccak256(randomness, i)`, and the game result recomputed in the browser matches the contract's `resultOf`.

## Layout

```
contracts/   Foundry
  src/PlaygroundGames.sol         all game logic, shared by both funding modes
  src/PlaygroundDirect.sol        direct funding: the player pays the wrapper per request, change refunded
  src/PlaygroundSubscription.sol  subscription: the app's subscription pays, the player pays only gas
  script/Deploy.s.sol             deploys both contracts
  test/Playground.t.sol           unit tests, plus one fork test against the live wrapper
web/         Vite + React + wagmi/viem + Tailwind
  src/lib/play.ts      quote, then send, then wait for the answer (it never re-requests)
  src/lib/verify.ts    the on-chain fairness check
  src/lib/games.ts     result math, mirrors the Solidity code
```

## Run it

You need [Foundry](https://getfoundry.sh), Node 20+, and a wallet holding some Arc Testnet USDC. A direct-funded play costs about 0.007 USDC at 25 gwei.

```bash
git submodule update --init --recursive
cd contracts && forge test
```

Optionally, run a smoke test of a real request against the live Arc VRF wrapper:

```bash
forge test --fork-url arc_testnet --mt test_fork
```

### Deploy

1. Create and fund a subscription at <https://arcvrf.007575.xyz/subscriptions>. 1 USDC covers many test requests. Note its id.
2. Deploy both playgrounds:
   ```bash
   PRIVATE_KEY=0x... SUB_ID=<id> forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast
   ```
3. On the subscription page, add the printed `PlaygroundSubscription` address as a consumer. Until you do, subscription-mode plays revert with `InvalidConsumer`.
4. Copy the three printed `VITE_*` lines into `web/.env`. See `web/.env.example`.

### Web

```bash
cd web && npm install && npm run dev
```

If you change the contracts, run `npm run abi` to regenerate `src/abi.ts` (this needs `forge` on your PATH).

## Fair-play rules the contracts follow

- **Lock inputs before requesting.** Ranges, guesses, dice counts and the raffle list hash are stored in the transaction that asks for randomness.
- **Never re-request.** A slow answer is still coming, and asking again would let someone discard results they dislike.
- **Keep the callback trivial.** `fulfillRandomWords` only stores words and updates counters. It never reverts, because a failed callback is charged and not retried.
- **Never spend the house balance.** Direct mode requires `msg.value >= price` and refunds the difference.
- **Results are public math.** `resultOf` and `winnersOf` are views over the stored words.

Arc VRF is unaudited testnet software that runs on a single operator. The operator can delay an answer but cannot change it.
