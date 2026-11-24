export const playgroundAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "wrapper",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "HILO_START_CARD",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_DICE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_RAFFLE_ENTRIES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_RAFFLE_WINNERS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allRequestIds",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "callbackGasFor",
    "inputs": [
      {
        "name": "game",
        "type": "uint8",
        "internalType": "enum PlaygroundGames.Game"
      },
      {
        "name": "numWords",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "drawWinners",
    "inputs": [
      {
        "name": "entries",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "winners",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "entriesHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "flipCoin",
    "inputs": [
      {
        "name": "guessHeads",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "getRequest",
    "inputs": [
      {
        "name": "requestId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct PlaygroundGames.Request",
        "components": [
          {
            "name": "player",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "game",
            "type": "uint8",
            "internalType": "enum PlaygroundGames.Game"
          },
          {
            "name": "a",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "b",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "commit",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "settled",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "words",
            "type": "uint256[]",
            "internalType": "uint256[]"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "i_vrfWrapper",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IArcVRFWrapper"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "playHiLo",
    "inputs": [
      {
        "name": "guessHigher",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "players",
    "inputs": [
      {
        "name": "player",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "plays",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "coinFlips",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "coinWins",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "hiloCard",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "hiloStreak",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "hiloBest",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "hiloPending",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "quote",
    "inputs": [
      {
        "name": "game",
        "type": "uint8",
        "internalType": "enum PlaygroundGames.Game"
      },
      {
        "name": "numWords",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "gasPriceWei",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "rawFulfillRandomWords",
    "inputs": [
      {
        "name": "_requestId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_randomWords",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "requestCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "requestNumber",
    "inputs": [
      {
        "name": "min",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "max",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "resultOf",
    "inputs": [
      {
        "name": "requestId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "out",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "rollDice",
    "inputs": [
      {
        "name": "count",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "sides",
        "type": "uint64",
        "internalType": "uint64"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "winnersOf",
    "inputs": [
      {
        "name": "requestId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "winners",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Requested",
    "inputs": [
      {
        "name": "requestId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "game",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum PlaygroundGames.Game"
      },
      {
        "name": "a",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "b",
        "type": "uint64",
        "indexed": false,
        "internalType": "uint64"
      },
      {
        "name": "commit",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Settled",
    "inputs": [
      {
        "name": "requestId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "player",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "game",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum PlaygroundGames.Game"
      },
      {
        "name": "words",
        "type": "uint256[]",
        "indexed": false,
        "internalType": "uint256[]"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BadDice",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadRaffle",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BadRange",
    "inputs": []
  },
  {
    "type": "error",
    "name": "HiLoRoundPending",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientPayment",
    "inputs": [
      {
        "name": "paid",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "price",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "OnlyVRFWrapperCanFulfill",
    "inputs": [
      {
        "name": "have",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "want",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "RefundFailed",
    "inputs": []
  }
] as const
