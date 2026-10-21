/* Kiko's puppet rig, generated from the Phase 1 layer kit (assets/kiko/manifest.json).
 * Positions and pivots are percentages of a 5:6 frame cropped from the kit's 1505×1405 canvas.
 * Regenerate rather than editing by hand. */
const KIKO_RIG = {
 "aspect": [
  1030,
  1236
 ],
 "groups": {
  "root": {
   "id": "root",
   "parent": null,
   "pivot": [
    55.825,
    98.706
   ]
  },
  "torso": {
   "id": "torso",
   "parent": "root",
   "pivot": [
    58.738,
    82.524
   ]
  },
  "head_group": {
   "id": "head_group",
   "parent": "torso",
   "pivot": [
    66.019,
    63.107
   ]
  }
 },
 "layers": [
  {
   "id": "tail",
   "parent": "torso",
   "pivot": [
    29.612,
    78.883
   ],
   "z": 3,
   "box": [
    11.553,
    71.764,
    21.165,
    14.563
   ]
  },
  {
   "id": "leg_left",
   "parent": "torso",
   "pivot": [
    35.922,
    87.217
   ],
   "z": 6,
   "box": [
    21.165,
    82.767,
    23.01,
    16.019
   ]
  },
  {
   "id": "leg_right",
   "parent": "torso",
   "pivot": [
    61.65,
    84.142
   ],
   "z": 8,
   "box": [
    51.65,
    70.307,
    39.903,
    28.641
   ]
  },
  {
   "id": "body",
   "parent": "torso",
   "pivot": [
    58.738,
    82.524
   ],
   "z": 10,
   "box": [
    28.835,
    58.819,
    51.456,
    34.304
   ]
  },
  {
   "id": "backpack",
   "parent": "torso",
   "pivot": [
    40.291,
    64.078
   ],
   "z": 20,
   "box": [
    20.194,
    54.935,
    32.524,
    27.023
   ]
  },
  {
   "id": "backpack_straps",
   "parent": "torso",
   "pivot": [
    55.34,
    66.343
   ],
   "z": 30,
   "box": [
    35.146,
    58.172,
    44.757,
    20.227
   ]
  },
  {
   "id": "arm_left",
   "parent": "torso",
   "pivot": [
    41.845,
    66.343
   ],
   "z": 40,
   "box": [
    37.767,
    60.356,
    26.408,
    15.21
   ]
  },
  {
   "id": "arm_right",
   "parent": "torso",
   "pivot": [
    79.515,
    70.307
   ],
   "z": 41,
   "box": [
    75.34,
    63.754,
    17.767,
    13.35
   ]
  },
  {
   "id": "ear_left",
   "parent": "head_group",
   "pivot": [
    55.34,
    32.767
   ],
   "z": 50,
   "box": [
    4.175,
    28.883,
    57.282,
    29.531
   ]
  },
  {
   "id": "ear_right",
   "parent": "head_group",
   "pivot": [
    61.456,
    25.324
   ],
   "z": 51,
   "box": [
    28.738,
    1.375,
    36.99,
    25.971
   ]
  },
  {
   "id": "head",
   "parent": "head_group",
   "pivot": [
    66.019,
    63.107
   ],
   "z": 60,
   "box": [
    33.786,
    22.573,
    62.427,
    43.932
   ]
  },
  {
   "id": "eye_left_open",
   "parent": "head_group",
   "pivot": [
    58.155,
    40.534
   ],
   "z": 70,
   "box": [
    50.194,
    34.142,
    15.146,
    11.327
   ],
   "variant": {
    "group": "eyes",
    "value": "open"
   }
  },
  {
   "id": "eye_left_closed",
   "parent": "head_group",
   "pivot": [
    58.155,
    40.534
   ],
   "z": 70,
   "box": [
    50.194,
    38.997,
    15.146,
    3.074
   ],
   "variant": {
    "group": "eyes",
    "value": "closed"
   }
  },
  {
   "id": "eye_right_open",
   "parent": "head_group",
   "pivot": [
    82.718,
    43.851
   ],
   "z": 71,
   "box": [
    77.476,
    38.754,
    10.68,
    10.194
   ],
   "variant": {
    "group": "eyes",
    "value": "open"
   }
  },
  {
   "id": "eye_right_closed",
   "parent": "head_group",
   "pivot": [
    82.718,
    43.851
   ],
   "z": 71,
   "box": [
    77.476,
    42.314,
    10.68,
    3.074
   ],
   "variant": {
    "group": "eyes",
    "value": "closed"
   }
  },
  {
   "id": "eyebrow_left",
   "parent": "head_group",
   "pivot": [
    58.155,
    40.534
   ],
   "z": 72,
   "box": [
    55.146,
    27.67,
    8.252,
    3.479
   ]
  },
  {
   "id": "eyebrow_right",
   "parent": "head_group",
   "pivot": [
    82.718,
    43.851
   ],
   "z": 72,
   "box": [
    81.553,
    32.12,
    5.437,
    4.288
   ]
  },
  {
   "id": "mouth_smile",
   "parent": "head_group",
   "pivot": [
    72.136,
    45.065
   ],
   "z": 80,
   "box": [
    63.592,
    42.961,
    14.66,
    13.997
   ],
   "variant": {
    "group": "mouth",
    "value": "smile"
   }
  },
  {
   "id": "mouth_neutral",
   "parent": "head_group",
   "pivot": [
    72.136,
    45.065
   ],
   "z": 80,
   "box": [
    65.437,
    42.961,
    12.524,
    7.767
   ],
   "variant": {
    "group": "mouth",
    "value": "neutral"
   }
  },
  {
   "id": "mouth_surprised",
   "parent": "head_group",
   "pivot": [
    72.136,
    45.065
   ],
   "z": 80,
   "box": [
    66.99,
    42.961,
    9.029,
    12.217
   ],
   "variant": {
    "group": "mouth",
    "value": "surprised"
   }
  }
 ],
 "limitsRad": {
  "head_group": [
   -0.04,
   0.04
  ],
  "ear_left": [
   -0.06,
   0.06
  ],
  "ear_right": [
   -0.06,
   0.06
  ],
  "arm_left": [
   -0.06,
   0.06
  ],
  "arm_right": [
   -0.06,
   0.06
  ],
  "torso": [
   -0.012,
   0.012
  ],
  "leg_left": [
   -0.07,
   0.07
  ],
  "leg_right": [
   -0.07,
   0.07
  ],
  "tail": [
   -0.08,
   0.08
  ]
 }
};
