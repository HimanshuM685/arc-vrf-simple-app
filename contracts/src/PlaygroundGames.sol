// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @title PlaygroundGames
/// @notice Every game in the Arc VRF playground. The funding method (direct funding through the
/// wrapper, or a subscription on the coordinator) lives in the two concrete contracts, which only
/// implement `_requestVrf` and forward the VRF callback to `_settle`.
///
/// Fair-play rules this contract follows (from the Arc VRF docs):
///  1. Every input that affects the outcome (range, dice count, guess, raffle list hash) is stored
///     BEFORE randomness is requested. Nothing can change after the request.
///  2. Each request is answered once. A missing answer is never re-requested.
///  3. The callback only stores words and updates counters: it cannot revert and does no external calls.
///  4. Results are pure functions of the stored random words, so anyone can recompute them
///     (see `resultOf` and `winnersOf`).
abstract contract PlaygroundGames {
  enum Game {
    Number,
    Dice,
    Coin,
    HiLo,
    Raffle
  }

  struct Request {
    address player;
    Game game;
    uint64 a; // Number: min | Dice: count | Coin: guessHeads | HiLo: guessHigher | Raffle: entries
    uint64 b; // Number: max | Dice: sides | Coin: -         | HiLo: previous card | Raffle: winners
    bytes32 commit; // Raffle: keccak256 of the entry list, locked before the draw
    bool settled;
    uint256[] words;
  }

  struct Player {
    uint64 plays;
    uint64 coinFlips;
    uint64 coinWins;
    uint8 hiloCard; // 0 means "never played", treated as the starting card 7
    uint32 hiloStreak;
    uint32 hiloBest;
    bool hiloPending;
  }

  uint8 public constant HILO_START_CARD = 7;
  uint32 public constant MAX_DICE = 10; // direct funding allows at most 10 words per request
  uint32 public constant MAX_RAFFLE_ENTRIES = 1000;
  uint32 public constant MAX_RAFFLE_WINNERS = 20;

  mapping(uint256 requestId => Request) internal s_requests;
  mapping(address player => Player) public players;
  uint256[] public allRequestIds;

  event Requested(uint256 indexed requestId, address indexed player, Game game, uint64 a, uint64 b, bytes32 commit);
  event Settled(uint256 indexed requestId, address indexed player, Game game, uint256[] words);

  error BadRange();
  error BadDice();
  error BadRaffle();
  error HiLoRoundPending();
  error RefundFailed();

  // ---------------------------------------------------------------- funding hook

  /// @return requestId VRF request id (identical on coordinator and wrapper)
  /// @return cost USDC (18 decimals) taken from msg.value; any extra is refunded
  function _requestVrf(uint32 numWords, uint32 callbackGasLimit) internal virtual returns (uint256 requestId, uint256 cost);

  // ---------------------------------------------------------------- games

  /// @notice Uniform-ish number in [min, max]: min + word % (max - min + 1).
  function requestNumber(uint64 min, uint64 max) external payable returns (uint256) {
    if (max < min) revert BadRange();
    return _request(Game.Number, 1, min, max, 0);
  }

  /// @notice Roll `count` dice with `sides` faces. One random word per die (numWords = count).
  function rollDice(uint64 count, uint64 sides) external payable returns (uint256) {
    if (count == 0 || count > MAX_DICE || sides < 2 || sides > 100) revert BadDice();
    return _request(Game.Dice, uint32(count), count, sides, 0);
  }

  /// @notice Call heads or tails. Heads when word is even.
  function flipCoin(bool guessHeads) external payable returns (uint256) {
    return _request(Game.Coin, 1, guessHeads ? 1 : 0, 0, 0);
  }

  /// @notice Guess whether the next card (1-13) is higher or lower than your current card.
  /// Only one round per player at a time: your current card is locked until the answer lands.
  function playHiLo(bool guessHigher) external payable returns (uint256) {
    Player storage p = players[msg.sender];
    if (p.hiloPending) revert HiLoRoundPending();
    p.hiloPending = true; // set before the external call so a reentrant play cannot slip in
    uint8 card = p.hiloCard == 0 ? HILO_START_CARD : p.hiloCard;
    return _request(Game.HiLo, 1, guessHigher ? 1 : 0, card, 0);
  }

  /// @notice Draw `winners` distinct entries out of `entries`. The list itself stays off-chain;
  /// its hash is committed here so nobody can reorder or edit it after the draw.
  function drawWinners(uint64 entries, uint64 winners, bytes32 entriesHash) external payable returns (uint256) {
    if (entries == 0 || entries > MAX_RAFFLE_ENTRIES || winners == 0 || winners > MAX_RAFFLE_WINNERS || winners > entries) {
      revert BadRaffle();
    }
    return _request(Game.Raffle, 1, entries, winners, entriesHash);
  }

  // ---------------------------------------------------------------- pricing helpers

  /// @notice Callback gas each game asks for. More words = more storage writes = more gas = higher fee.
  function callbackGasFor(Game game, uint32 numWords) public pure returns (uint32) {
    return (game == Game.HiLo ? 90_000 : 60_000) + 30_000 * numWords;
  }

  // ---------------------------------------------------------------- internals

  function _request(Game game, uint32 numWords, uint64 a, uint64 b, bytes32 commit) internal returns (uint256 requestId) {
    uint256 cost;
    (requestId, cost) = _requestVrf(numWords, callbackGasFor(game, numWords));

    Request storage r = s_requests[requestId];
    r.player = msg.sender;
    r.game = game;
    r.a = a;
    r.b = b;
    r.commit = commit;
    allRequestIds.push(requestId);
    players[msg.sender].plays++;
    emit Requested(requestId, msg.sender, game, a, b, commit);

    // Refund change last, after all state is written.
    if (msg.value > cost) {
      (bool ok,) = msg.sender.call{value: msg.value - cost}("");
      if (!ok) revert RefundFailed();
    }
  }

  /// @dev VRF callback body. Must never revert: unknown or repeated ids are ignored.
  function _settle(uint256 requestId, uint256[] memory words) internal {
    Request storage r = s_requests[requestId];
    if (r.player == address(0) || r.settled) return;
    r.settled = true;
    r.words = words;

    if (r.game == Game.Coin) {
      Player storage p = players[r.player];
      p.coinFlips++;
      if ((words[0] % 2 == 0) == (r.a == 1)) p.coinWins++;
    } else if (r.game == Game.HiLo) {
      Player storage p = players[r.player];
      uint8 next = uint8(words[0] % 13) + 1;
      if (next != r.b) {
        bool won = (r.a == 1) == (next > r.b);
        if (won) {
          p.hiloStreak++;
          if (p.hiloStreak > p.hiloBest) p.hiloBest = p.hiloStreak;
        } else {
          p.hiloStreak = 0;
        }
      }
      p.hiloCard = next;
      p.hiloPending = false;
    }
    emit Settled(requestId, r.player, r.game, words);
  }

  // ---------------------------------------------------------------- views

  function getRequest(uint256 requestId) external view returns (Request memory) {
    return s_requests[requestId];
  }

  function requestCount() external view returns (uint256) {
    return allRequestIds.length;
  }

  /// @notice The game outcome, recomputed from the stored random words. Empty until settled.
  ///  Number: [value]
  ///  Dice:   [die1, die2, ...]
  ///  Coin:   [heads (1/0), won (1/0)]
  ///  HiLo:   [previousCard, newCard, outcome (0 lose, 1 win, 2 tie)]
  ///  Raffle: winning entry indexes (0-based), see winnersOf
  function resultOf(uint256 requestId) external view returns (uint256[] memory out) {
    Request storage r = s_requests[requestId];
    if (!r.settled) return out;
    uint256[] storage w = r.words;

    if (r.game == Game.Number) {
      out = new uint256[](1);
      out[0] = uint256(r.a) + (w[0] % (uint256(r.b) - r.a + 1));
    } else if (r.game == Game.Dice) {
      out = new uint256[](w.length);
      for (uint256 i; i < w.length; ++i) out[i] = (w[i] % r.b) + 1;
    } else if (r.game == Game.Coin) {
      out = new uint256[](2);
      bool heads = w[0] % 2 == 0;
      out[0] = heads ? 1 : 0;
      out[1] = heads == (r.a == 1) ? 1 : 0;
    } else if (r.game == Game.HiLo) {
      out = new uint256[](3);
      uint256 next = (w[0] % 13) + 1;
      out[0] = r.b;
      out[1] = next;
      out[2] = next == r.b ? 2 : ((r.a == 1) == (next > r.b) ? 1 : 0);
    } else {
      out = winnersOf(requestId);
    }
  }

  /// @notice Raffle winners: partial Fisher-Yates shuffle of [0, entries) driven by one word.
  /// Step i picks keccak256(word, i) % (entries - i) among the not-yet-picked entries.
  function winnersOf(uint256 requestId) public view returns (uint256[] memory winners) {
    Request storage r = s_requests[requestId];
    if (!r.settled || r.game != Game.Raffle) return winners;
    uint256 n = r.a;
    uint256 k = r.b;
    uint256 word = r.words[0];
    uint256[] memory pool = new uint256[](n);
    for (uint256 i; i < n; ++i) pool[i] = i;
    winners = new uint256[](k);
    for (uint256 i; i < k; ++i) {
      uint256 j = i + (uint256(keccak256(abi.encode(word, i))) % (n - i));
      (pool[i], pool[j]) = (pool[j], pool[i]);
      winners[i] = pool[i];
    }
  }
}
