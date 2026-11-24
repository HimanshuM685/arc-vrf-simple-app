// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {ArcVRFConsumerBase} from "arc-vrf/ArcVRFConsumerBase.sol";
import {ArcVRFClient} from "arc-vrf/libraries/ArcVRFClient.sol";
import {PlaygroundGames} from "./PlaygroundGames.sol";

/// @notice Playground paid by a SUBSCRIPTION: the owner funds a subscription on the coordinator
/// and adds this contract as a consumer. Players pay only gas; the subscription is charged when
/// each request is fulfilled. Any USDC sent with a play is refunded.
contract PlaygroundSubscription is PlaygroundGames, ArcVRFConsumerBase {
  bytes32 public s_keyHash;
  uint256 public s_subId;

  constructor(address coordinator, bytes32 keyHash, uint256 subId) ArcVRFConsumerBase(coordinator) {
    s_keyHash = keyHash;
    s_subId = subId;
  }

  function setSubscription(bytes32 keyHash, uint256 subId) external onlyOwner {
    s_keyHash = keyHash;
    s_subId = subId;
  }

  function _requestVrf(uint32 numWords, uint32 callbackGasLimit) internal override returns (uint256 requestId, uint256 cost) {
    requestId = s_vrfCoordinator.requestRandomWords(
      ArcVRFClient.RandomWordsRequest({
        keyHash: s_keyHash,
        subId: s_subId,
        requestConfirmations: 0, // Arc finalises on inclusion
        callbackGasLimit: callbackGasLimit,
        numWords: numWords,
        extraArgs: ArcVRFClient.nativeExtraArgs()
      })
    );
    cost = 0;
  }

  function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
    _settle(requestId, randomWords);
  }
}
