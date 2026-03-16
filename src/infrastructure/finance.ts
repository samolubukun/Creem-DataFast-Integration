const CURRENCY_EXPONENTS: Record<string, number> = {
  BHD: 3,
  CLF: 4,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  MGA: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VUV: 0,
  VND: 0,
  XAF: 0,
  XBA: 0,
  XBB: 0,
  XBC: 0,
  XBD: 0,
  XOF: 0,
  XPF: 0,
};

/**
 * Converts minor currency units (e.g. cents) to major units (e.g. dollars).
 * Accounts for 0, 2, 3, and 4 decimal places depending on the currency.
 */
export function minorToMajor(amount: number, currency: string): number {
  const exponent = CURRENCY_EXPONENTS[currency.toUpperCase()] ?? 2;
  const factor = 10 ** exponent;
  return amount / factor;
}
