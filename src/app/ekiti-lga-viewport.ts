/** Lightweight map camera extents, computed offline from data/grid3/lga.json
 * (GRID3/eHealth Africa and Proxy Logics 2020, CC BY 4.0). No invented
 * coordinates, third-party map API or browser GPS. Source polygons remain
 * the only authoritative geographic display for these extents. */
export type LgaBounds = [[number, number], [number, number]];
export const ekitiLgaBounds: Readonly<Record<string, LgaBounds>> = {
  "oye": [
    [
      5.241356,
      7.715516
    ],
    [
      5.445496,
      8.091933
    ]
  ],
  "ikole": [
    [
      5.365753,
      7.650025
    ],
    [
      5.668087,
      8.111246
    ]
  ],
  "moba": [
    [
      5.020274,
      7.928535
    ],
    [
      5.250178,
      8.062994
    ]
  ],
  "adoekiti": [
    [
      5.113187,
      7.540195
    ],
    [
      5.369153,
      7.700854
    ]
  ],
  "idoosi": [
    [
      5.069444,
      7.764225
    ],
    [
      5.258408,
      7.942322
    ]
  ],
  "ekitisouthwest": [
    [
      4.919434,
      7.413933
    ],
    [
      5.171856,
      7.636696
    ]
  ],
  "ilejemeje": [
    [
      5.161179,
      7.877726
    ],
    [
      5.271652,
      8.002368
    ]
  ],
  "gbonyin": [
    [
      5.347138,
      7.473188
    ],
    [
      5.638619,
      7.701626
    ]
  ],
  "irepodunifelodun": [
    [
      5.097775,
      7.636013
    ],
    [
      5.43983,
      7.792532
    ]
  ],
  "ekitieast": [
    [
      5.561711,
      7.605001
    ],
    [
      5.791615,
      7.830088
    ]
  ],
  "iseorun": [
    [
      5.304219,
      7.283187
    ],
    [
      5.540538,
      7.567046
    ]
  ],
  "emure": [
    [
      5.432181,
      7.301759
    ],
    [
      5.60547,
      7.515194
    ]
  ],
  "ikere": [
    [
      5.086198,
      7.43344
    ],
    [
      5.327876,
      7.588445
    ]
  ],
  "ijero": [
    [
      4.942339,
      7.729248
    ],
    [
      5.148681,
      7.960936
    ]
  ],
  "efon": [
    [
      4.863862,
      7.546576
    ],
    [
      5.016644,
      7.810518
    ]
  ],
  "ekitiwest": [
    [
      4.908579,
      7.521454
    ],
    [
      5.115531,
      7.902163
    ]
  ]
};

export function normalizeLgaName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]/g,'');
}
export function boundsForLga(name: string): LgaBounds | null {
  return ekitiLgaBounds[normalizeLgaName(name)] ?? null;
}
