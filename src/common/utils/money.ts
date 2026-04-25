// Fixed-point money arithmetic backed by BigInt minor units (cents). Avoids
// the precision drift that comes from using `parseFloat` + `.toFixed(2)`
// for monetary calculations (e.g. balance deductions, refunds, commissions).
//
// All inputs accept either a `numeric(n,2)` string from PostgreSQL ("1234.56")
// or a JS number. Internal arithmetic is integer; output is fixed-point string
// suitable for writing back to a `numeric(n,2)` column or a `number` JSON field.

const MONEY_DECIMAL_PLACES = 2;
const RATE_DECIMAL_PLACES = 4;

const MONEY_PATTERN = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;
const RATE_PATTERN = /^(-?)(\d+)(?:\.(\d{1,4}))?$/;

function toMinorUnits(value: string | number): bigint {
  const str = typeof value === 'number' ? value.toString() : value.trim();
  const match = MONEY_PATTERN.exec(str);
  if (!match) throw new Error(`Invalid money value: ${value}`);
  const [, sign, intPart, fracPart = ''] = match;
  const padded = (fracPart + '00').slice(0, MONEY_DECIMAL_PLACES);
  return BigInt(`${sign}${intPart}${padded}`);
}

function fromMinorUnits(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const padded = abs.toString().padStart(MONEY_DECIMAL_PLACES + 1, '0');
  const intPart = padded.slice(0, -MONEY_DECIMAL_PLACES);
  const fracPart = padded.slice(-MONEY_DECIMAL_PLACES);
  return `${negative ? '-' : ''}${intPart}.${fracPart}`;
}

// Half-away-from-zero rounding to keep behaviour predictable across signs.
function divRound(numerator: bigint, denominator: bigint): bigint {
  const half = denominator / 2n;
  return numerator >= 0n ? (numerator + half) / denominator : -((-numerator + half) / denominator);
}

export class Money {
  private constructor(private readonly minor: bigint) {}

  public static from(value: string | number): Money {
    return new Money(toMinorUnits(value));
  }

  public static zero(): Money {
    return new Money(0n);
  }

  /** Sums an array of money values without intermediate float math. */
  public static sum(values: Array<string | number>): Money {
    return values.reduce<Money>((acc, v) => acc.add(Money.from(v)), Money.zero());
  }

  public add(other: Money): Money {
    return new Money(this.minor + other.minor);
  }

  public sub(other: Money): Money {
    return new Money(this.minor - other.minor);
  }

  /**
   * Multiplies the amount by a decimal rate (e.g. commission `"0.25"`). The
   * rate is parsed at fixed precision so float multiplication never appears.
   */
  public mulRate(rate: string | number): Money {
    const str = typeof rate === 'number' ? rate.toString() : rate.trim();
    const match = RATE_PATTERN.exec(str);
    if (!match) throw new Error(`Invalid rate: ${rate}`);
    const [, sign, intPart, fracPart = ''] = match;
    const padded = (fracPart + '0000').slice(0, RATE_DECIMAL_PLACES);
    const rateMinor = BigInt(`${sign}${intPart}${padded}`);
    const product = this.minor * rateMinor;
    const denominator = 10n ** BigInt(RATE_DECIMAL_PLACES);
    return new Money(divRound(product, denominator));
  }

  public gte(other: Money): boolean {
    return this.minor >= other.minor;
  }

  public lt(other: Money): boolean {
    return this.minor < other.minor;
  }

  public isNegative(): boolean {
    return this.minor < 0n;
  }

  /** Fixed-point string ("1234.56") suitable for writing to numeric(n,2) columns. */
  public toFixedString(): string {
    return fromMinorUnits(this.minor);
  }

  /**
   * Number representation for response payloads. Safe for amounts up to
   * Number.MAX_SAFE_INTEGER cents (~$90 trillion); the column constraint
   * (numeric(12,2)) is well below that.
   */
  public toNumber(): number {
    return Number(this.toFixedString());
  }
}
