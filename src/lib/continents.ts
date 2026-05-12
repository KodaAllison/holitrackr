export type Continent =
  | 'Africa'
  | 'Antarctica'
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'Oceania'
  | 'South America'

export const countryContinent: Record<string, Continent> = {
  // Africa
  DZA: 'Africa',
  AGO: 'Africa',
  BEN: 'Africa',
  BWA: 'Africa',
  BFA: 'Africa',
  BDI: 'Africa',
  CPV: 'Africa',
  CMR: 'Africa',
  CAF: 'Africa',
  TCD: 'Africa',
  COM: 'Africa',
  COD: 'Africa',
  COG: 'Africa',
  CIV: 'Africa',
  DJI: 'Africa',
  EGY: 'Africa',
  GNQ: 'Africa',
  ERI: 'Africa',
  SWZ: 'Africa',
  ETH: 'Africa',
  GAB: 'Africa',
  GMB: 'Africa',
  GHA: 'Africa',
  GIN: 'Africa',
  GNB: 'Africa',
  KEN: 'Africa',
  LSO: 'Africa',
  LBR: 'Africa',
  LBY: 'Africa',
  MDG: 'Africa',
  MWI: 'Africa',
  MLI: 'Africa',
  MRT: 'Africa',
  MUS: 'Africa',
  MAR: 'Africa',
  MOZ: 'Africa',
  NAM: 'Africa',
  NER: 'Africa',
  NGA: 'Africa',
  RWA: 'Africa',
  STP: 'Africa',
  SEN: 'Africa',
  SLE: 'Africa',
  SOM: 'Africa',
  ZAF: 'Africa',
  SSD: 'Africa',
  SDN: 'Africa',
  TZA: 'Africa',
  TGO: 'Africa',
  TUN: 'Africa',
  UGA: 'Africa',
  ZMB: 'Africa',
  ZWE: 'Africa',
  // Additional African territories and islands
  ESH: 'Africa', // Western Sahara
  REU: 'Africa', // Réunion
  MYT: 'Africa', // Mayotte
  SHN: 'Africa', // Saint Helena, Ascension and Tristan da Cunha
  IOT: 'Africa', // British Indian Ocean Territory (geographically closer to Africa/Asia)

  // Antarctica
  ATA: 'Antarctica',
  BVT: 'Antarctica', // Bouvet Island
  SGS: 'Antarctica', // South Georgia and the South Sandwich Islands
  HMD: 'Antarctica', // Heard Island and McDonald Islands
  ATF: 'Antarctica', // French Southern Territories

  // Asia
  AFG: 'Asia',
  ARM: 'Asia',
  AZE: 'Asia',
  BHR: 'Asia',
  BGD: 'Asia',
  BTN: 'Asia',
  BRN: 'Asia',
  KHM: 'Asia',
  CHN: 'Asia',
  CYP: 'Asia',
  GEO: 'Asia',
  IND: 'Asia',
  IDN: 'Asia',
  IRN: 'Asia',
  IRQ: 'Asia',
  ISR: 'Asia',
  JPN: 'Asia',
  JOR: 'Asia',
  KAZ: 'Asia',
  KWT: 'Asia',
  KGZ: 'Asia',
  LAO: 'Asia',
  LBN: 'Asia',
  MYS: 'Asia',
  MDV: 'Asia',
  MNG: 'Asia',
  MMR: 'Asia',
  NPL: 'Asia',
  PRK: 'Asia',
  OMN: 'Asia',
  PAK: 'Asia',
  PSE: 'Asia',
  PHL: 'Asia',
  QAT: 'Asia',
  SAU: 'Asia',
  SGP: 'Asia',
  KOR: 'Asia',
  LKA: 'Asia',
  SYR: 'Asia',
  TWN: 'Asia',
  TJK: 'Asia',
  THA: 'Asia',
  TLS: 'Asia',
  TUR: 'Asia',
  TKM: 'Asia',
  ARE: 'Asia',
  UZB: 'Asia',
  VNM: 'Asia',
  YEM: 'Asia',
  // Additional Asian territories
  HKG: 'Asia', // Hong Kong
  MAC: 'Asia', // Macao
  CCK: 'Asia', // Cocos (Keeling) Islands
  CXR: 'Asia', // Christmas Island

  // Europe
  ALB: 'Europe',
  AND: 'Europe',
  AUT: 'Europe',
  BLR: 'Europe',
  BEL: 'Europe',
  BIH: 'Europe',
  BGR: 'Europe',
  HRV: 'Europe',
  CZE: 'Europe',
  DNK: 'Europe',
  EST: 'Europe',
  FIN: 'Europe',
  FRA: 'Europe',
  DEU: 'Europe',
  GRC: 'Europe',
  HUN: 'Europe',
  ISL: 'Europe',
  IRL: 'Europe',
  ITA: 'Europe',
  XKX: 'Europe', // Kosovo
  LVA: 'Europe',
  LIE: 'Europe',
  LTU: 'Europe',
  LUX: 'Europe',
  MLT: 'Europe',
  MDA: 'Europe',
  MCO: 'Europe',
  MNE: 'Europe',
  NLD: 'Europe',
  MKD: 'Europe',
  NOR: 'Europe',
  POL: 'Europe',
  PRT: 'Europe',
  ROU: 'Europe',
  RUS: 'Europe',
  SMR: 'Europe',
  SRB: 'Europe',
  SVK: 'Europe',
  SVN: 'Europe',
  ESP: 'Europe',
  SWE: 'Europe',
  CHE: 'Europe',
  UKR: 'Europe',
  GBR: 'Europe',
  VAT: 'Europe',
  // Additional European territories
  GIB: 'Europe', // Gibraltar
  FRO: 'Europe', // Faroe Islands
  GGY: 'Europe', // Guernsey
  IMN: 'Europe', // Isle of Man
  JEY: 'Europe', // Jersey
  ALA: 'Europe', // Åland Islands
  SJM: 'Europe', // Svalbard and Jan Mayen
  NLD_BES: 'Europe', // Bonaire, Sint Eustatius and Saba (Caribbean Netherlands - administratively Europe)

  // North America
  ATG: 'North America',
  BHS: 'North America',
  BRB: 'North America',
  BLZ: 'North America',
  CAN: 'North America',
  CRI: 'North America',
  CUB: 'North America',
  DMA: 'North America',
  DOM: 'North America',
  SLV: 'North America',
  GRD: 'North America',
  GTM: 'North America',
  HTI: 'North America',
  HND: 'North America',
  JAM: 'North America',
  MEX: 'North America',
  NIC: 'North America',
  PAN: 'North America',
  KNA: 'North America',
  LCA: 'North America',
  VCT: 'North America',
  TTO: 'North America',
  USA: 'North America',
  // Additional North American territories
  ABW: 'North America', // Aruba
  AIA: 'North America', // Anguilla
  ANT: 'North America', // Netherlands Antilles (dissolved, kept for legacy codes)
  BES: 'North America', // Bonaire, Sint Eustatius and Saba
  BLM: 'North America', // Saint Barthélemy
  BMU: 'North America', // Bermuda
  CUW: 'North America', // Curaçao
  CYM: 'North America', // Cayman Islands
  GLP: 'North America', // Guadeloupe
  GRL: 'North America', // Greenland

  MAF: 'North America', // Saint Martin (French part)
  MSR: 'North America', // Montserrat
  MTQ: 'North America', // Martinique
  PRI: 'North America', // Puerto Rico
  SXM: 'North America', // Sint Maarten (Dutch part)
  TCA: 'North America', // Turks and Caicos Islands
  VGB: 'North America', // British Virgin Islands
  VIR: 'North America', // U.S. Virgin Islands
  SPM: 'North America', // Saint Pierre and Miquelon

  // Oceania
  AUS: 'Oceania',
  FJI: 'Oceania',
  KIR: 'Oceania',
  MHL: 'Oceania',
  FSM: 'Oceania',
  NRU: 'Oceania',
  NZL: 'Oceania',
  PLW: 'Oceania',
  PNG: 'Oceania',
  WSM: 'Oceania',
  SLB: 'Oceania',
  TON: 'Oceania',
  TUV: 'Oceania',
  VUT: 'Oceania',
  // Additional Oceanian territories
  ASM: 'Oceania', // American Samoa
  COK: 'Oceania', // Cook Islands
  GUM: 'Oceania', // Guam
  MNP: 'Oceania', // Northern Mariana Islands
  NCL: 'Oceania', // New Caledonia
  NIU: 'Oceania', // Niue
  NFK: 'Oceania', // Norfolk Island
  PCN: 'Oceania', // Pitcairn Islands
  PYF: 'Oceania', // French Polynesia
  TKL: 'Oceania', // Tokelau
  UMI: 'Oceania', // United States Minor Outlying Islands
  WLF: 'Oceania', // Wallis and Futuna

  // South America
  ARG: 'South America',
  BOL: 'South America',
  BRA: 'South America',
  CHL: 'South America',
  COL: 'South America',
  ECU: 'South America',
  GUY: 'South America',
  PRY: 'South America',
  PER: 'South America',
  SUR: 'South America',
  URY: 'South America',
  VEN: 'South America',
  // Additional South American territories
  FLK: 'South America', // Falkland Islands
  GUF: 'South America', // French Guiana
}

export function getContinent(code: string): Continent {
  return countryContinent[code] ?? ('Other' as Continent)
}
