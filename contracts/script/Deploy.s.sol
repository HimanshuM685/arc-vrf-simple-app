// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {PlaygroundDirect} from "../src/PlaygroundDirect.sol";
import {PlaygroundSubscription} from "../src/PlaygroundSubscription.sol";

/// Deploys both playgrounds to Arc Testnet.
///   PRIVATE_KEY=0x... SUB_ID=<your subscription id> \
///   forge script script/Deploy.s.sol --rpc-url arc_testnet --broadcast
/// Then add the PlaygroundSubscription address as a consumer of SUB_ID at
/// https://arcvrf.007575.xyz/subscriptions
contract Deploy is Script {
  // Arc Testnet (chain 5042002), from https://arcvrf.007575.xyz/docs#addresses
  address constant COORDINATOR = 0xe852aAb2d5c609B89Ea2B39e1451608D8649827a;
  address constant WRAPPER = 0xD854D5F611938F60D614a69Ec58033d37aF54d75;
  bytes32 constant KEY_HASH = 0xcf39e27191d1d13c8fec1a175eda831392ef974fe21a5a0a0680c3a22c6deb88;

  function run() external {
    uint256 subId = vm.envUint("SUB_ID");
    vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
    PlaygroundDirect direct = new PlaygroundDirect(WRAPPER);
    PlaygroundSubscription sub = new PlaygroundSubscription(COORDINATOR, KEY_HASH, subId);
    vm.stopBroadcast();

    console.log("VITE_DIRECT_ADDRESS=%s", address(direct));
    console.log("VITE_SUB_ADDRESS=%s", address(sub));
    console.log("VITE_SUB_ID=%s", subId);
  }
}
