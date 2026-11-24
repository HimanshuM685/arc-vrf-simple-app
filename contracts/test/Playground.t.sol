// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Test} from "forge-std/Test.sol";
import {ArcVRFClient} from "arc-vrf/libraries/ArcVRFClient.sol";
import {PlaygroundGames} from "../src/PlaygroundGames.sol";
import {PlaygroundDirect} from "../src/PlaygroundDirect.sol";
import {PlaygroundSubscription} from "../src/PlaygroundSubscription.sol";

interface IRawFulfill {
  function rawFulfillRandomWords(uint256 requestId, uint256[] memory words) external;
}

/// Stand-in for both the wrapper and the coordinator: records the consumer, delivers chosen words.
contract MockVRF {
  uint256 public constant PRICE = 0.001 ether;
  uint256 public nextId = 1;
  mapping(uint256 => address) public consumerOf;
  mapping(uint256 => uint32) public numWordsOf;

  function calculateRequestPriceNative(uint32, uint32) external pure returns (uint256) {
    return PRICE;
  }

  function estimateRequestPriceNative(uint32, uint32, uint256) external pure returns (uint256) {
    return PRICE;
  }

  function requestRandomWordsInNative(uint32, uint16, uint32 numWords, bytes calldata) external payable returns (uint256) {
    require(msg.value == PRICE, "fee");
    return _store(numWords);
  }

  function requestRandomWords(ArcVRFClient.RandomWordsRequest calldata req) external returns (uint256) {
    return _store(req.numWords);
  }

  function _store(uint32 numWords) internal returns (uint256 id) {
    id = nextId++;
    consumerOf[id] = msg.sender;
    numWordsOf[id] = numWords;
  }

  function fulfill(uint256 id, uint256[] memory words) external {
    require(words.length == numWordsOf[id], "words");
    IRawFulfill(consumerOf[id]).rawFulfillRandomWords(id, words);
  }
}

contract PlaygroundTest is Test {
  MockVRF vrf;
  PlaygroundDirect direct;
  PlaygroundSubscription sub;
  address alice = makeAddr("alice");

  function setUp() public {
    vrf = new MockVRF();
    direct = new PlaygroundDirect(address(vrf));
    sub = new PlaygroundSubscription(address(vrf), bytes32(uint256(1)), 42);
    vm.deal(alice, 1 ether);
  }

  function _words(uint256 w) internal pure returns (uint256[] memory a) {
    a = new uint256[](1);
    a[0] = w;
  }

  function test_number_inRange() public {
    vm.prank(alice);
    uint256 id = direct.requestNumber{value: 0.001 ether}(10, 20);
    vrf.fulfill(id, _words(25)); // 10 + 25 % 11 = 13
    assertEq(direct.resultOf(id)[0], 13);
  }

  function test_number_fullRangeNoOverflow() public {
    vm.prank(alice);
    uint256 id = direct.requestNumber{value: 0.001 ether}(0, type(uint64).max);
    vrf.fulfill(id, _words(type(uint256).max));
    assertLe(direct.resultOf(id)[0], type(uint64).max);
  }

  function test_dice_oneWordPerDie() public {
    vm.prank(alice);
    uint256 id = direct.rollDice{value: 0.001 ether}(3, 6);
    assertEq(vrf.numWordsOf(id), 3);
    uint256[] memory w = new uint256[](3);
    (w[0], w[1], w[2]) = (0, 5, 13); // -> 1, 6, 2
    vrf.fulfill(id, w);
    uint256[] memory r = direct.resultOf(id);
    assertEq(r[0], 1);
    assertEq(r[1], 6);
    assertEq(r[2], 2);
  }

  function test_dice_limits() public {
    vm.startPrank(alice);
    vm.expectRevert(PlaygroundGames.BadDice.selector);
    direct.rollDice{value: 0.001 ether}(11, 6);
    vm.expectRevert(PlaygroundGames.BadDice.selector);
    direct.rollDice{value: 0.001 ether}(1, 1);
  }

  function test_coin_statsAndResult() public {
    vm.prank(alice);
    uint256 id = direct.flipCoin{value: 0.001 ether}(true);
    vrf.fulfill(id, _words(4)); // even = heads
    uint256[] memory r = direct.resultOf(id);
    assertEq(r[0], 1);
    assertEq(r[1], 1);
    (, uint64 flips, uint64 wins,,,,) = direct.players(alice);
    assertEq(flips, 1);
    assertEq(wins, 1);
  }

  function test_hilo_lockStreakAndTie() public {
    vm.startPrank(alice);
    uint256 id = direct.playHiLo{value: 0.001 ether}(true); // from card 7
    vm.expectRevert(PlaygroundGames.HiLoRoundPending.selector);
    direct.playHiLo{value: 0.001 ether}(false);
    vm.stopPrank();

    vrf.fulfill(id, _words(9)); // 9 % 13 + 1 = 10 > 7, win
    uint256[] memory r = direct.resultOf(id);
    assertEq(r[0], 7);
    assertEq(r[1], 10);
    assertEq(r[2], 1);
    (,,, uint8 card, uint32 streak, uint32 best, bool pending) = direct.players(alice);
    assertEq(card, 10);
    assertEq(streak, 1);
    assertEq(best, 1);
    assertFalse(pending);

    vm.prank(alice);
    id = direct.playHiLo{value: 0.001 ether}(false);
    vrf.fulfill(id, _words(9)); // 10 again: tie, streak kept
    assertEq(direct.resultOf(id)[2], 2);
    (,,,, streak,,) = direct.players(alice);
    assertEq(streak, 1);

    vm.prank(alice);
    id = direct.playHiLo{value: 0.001 ether}(false);
    vrf.fulfill(id, _words(12)); // 13 > 10 but guessed lower: lose
    assertEq(direct.resultOf(id)[2], 0);
    (,,,, streak, best,) = direct.players(alice);
    assertEq(streak, 0);
    assertEq(best, 1);
  }

  function test_raffle_uniqueWinnersInRange() public {
    vm.prank(alice);
    uint256 id = direct.drawWinners{value: 0.001 ether}(50, 20, keccak256("list"));
    vrf.fulfill(id, _words(uint256(keccak256("seed"))));
    uint256[] memory w = direct.winnersOf(id);
    assertEq(w.length, 20);
    for (uint256 i; i < w.length; ++i) {
      assertLt(w[i], 50);
      for (uint256 j; j < i; ++j) assertTrue(w[i] != w[j]);
    }
    assertEq(direct.getRequest(id).commit, keccak256("list"));
  }

  function test_direct_refundsChange() public {
    vm.prank(alice);
    direct.flipCoin{value: 0.01 ether}(true);
    assertEq(alice.balance, 1 ether - 0.001 ether);
    assertEq(address(direct).balance, 0);
  }

  function test_direct_insufficientPayment() public {
    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(PlaygroundDirect.InsufficientPayment.selector, 0.0005 ether, 0.001 ether));
    direct.flipCoin{value: 0.0005 ether}(true);
  }

  function test_direct_neverSpendsHouseBalance() public {
    vm.deal(address(direct), 1 ether);
    vm.prank(alice);
    vm.expectRevert();
    direct.flipCoin(true);
  }

  function test_settle_ignoresRepeatAndUnknown() public {
    vm.prank(alice);
    uint256 id = direct.flipCoin{value: 0.001 ether}(true);
    vrf.fulfill(id, _words(4));
    vm.prank(address(vrf));
    direct.rawFulfillRandomWords(id, _words(5)); // second answer ignored
    assertEq(direct.getRequest(id).words[0], 4);
    vm.prank(address(vrf));
    direct.rawFulfillRandomWords(999, _words(5)); // unknown id: no revert
  }

  function test_onlyVrfCanFulfill() public {
    vm.expectRevert();
    direct.rawFulfillRandomWords(1, _words(1));
    vm.expectRevert();
    sub.rawFulfillRandomWords(1, _words(1));
  }

  function test_subscription_freeForPlayer() public {
    vm.prank(alice);
    uint256 id = sub.rollDice{value: 0.002 ether}(2, 20); // value refunded in full
    assertEq(alice.balance, 1 ether);
    uint256[] memory w = new uint256[](2);
    (w[0], w[1]) = (19, 40);
    vrf.fulfill(id, w);
    uint256[] memory r = sub.resultOf(id);
    assertEq(r[0], 20);
    assertEq(r[1], 1);
  }

  /// Against the live Arc Testnet wrapper: `forge test --fork-url arc_testnet --mt test_fork`.
  /// Only checks the request side; the answer comes later from the real Arc VRF node.
  function test_fork_directRequestOnLiveWrapper() public {
    if (block.chainid != 5042002) return;
    PlaygroundDirect live = new PlaygroundDirect(0xD854D5F611938F60D614a69Ec58033d37aF54d75);
    vm.txGasPrice(25 gwei);
    uint256 price = live.quote(PlaygroundGames.Game.Coin, 1, 25 gwei);
    assertGt(price, 0);
    vm.prank(alice);
    uint256 id = live.flipCoin{value: price * 2}(true);
    assertGt(id, 0);
    assertEq(alice.balance, 1 ether - price);
  }
}
