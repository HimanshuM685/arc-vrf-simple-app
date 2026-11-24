// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ArcVRFWrapperConsumerBase} from "arc-vrf/ArcVRFWrapperConsumerBase.sol";
import {ArcVRFClient} from "arc-vrf/libraries/ArcVRFClient.sol";
import {PlaygroundGames} from "./PlaygroundGames.sol";

/// @notice Playground paid by DIRECT FUNDING: each player sends USDC with the call, the contract
/// pays the Arc VRF wrapper for exactly that request and refunds the change. No subscription.
contract PlaygroundDirect is PlaygroundGames, ArcVRFWrapperConsumerBase {
  error InsufficientPayment(uint256 paid, uint256 price);

  constructor(address wrapper) ArcVRFWrapperConsumerBase(wrapper) {}

  /// @notice Fee in USDC (18 decimals) for one play at `gasPriceWei`. Quote at your transaction's
  /// maxFeePerGas (Arc floors it at 20 gwei) and send at least this much.
  function quote(Game game, uint32 numWords, uint256 gasPriceWei) external view returns (uint256) {
    return i_vrfWrapper.estimateRequestPriceNative(callbackGasFor(game, numWords), numWords, gasPriceWei);
  }

  function _requestVrf(uint32 numWords, uint32 callbackGasLimit) internal override returns (uint256 requestId, uint256 cost) {
    // The player covers the price; never spend USDC that happens to sit in this contract.
    uint256 price = i_vrfWrapper.calculateRequestPriceNative(callbackGasLimit, numWords);
    if (msg.value < price) revert InsufficientPayment(msg.value, price);
    // requestConfirmations = 0: Arc blocks are final on inclusion.
    (requestId, cost) = requestRandomnessPayInNative(callbackGasLimit, 0, numWords, ArcVRFClient.nativeExtraArgs());
  }

  function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
    _settle(requestId, randomWords);
  }

  receive() external payable {}
}
