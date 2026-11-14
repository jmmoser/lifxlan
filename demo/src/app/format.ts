/** Text formatting shared by the wire log, the inspector, and the code view. */

export const hexByte = (byte: number): string => byte.toString(16).padStart(2, '0');

export function hex(bytes: Uint8Array, separator = ' '): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += (i ? separator : '') + hexByte(bytes[i]!);
  return out;
}

/** Parses "31 00 00 34 …" (any spacing, optional 0x prefixes). Returns undefined when it is not hex. */
export function parseHex(input: string): Uint8Array | undefined {
  const digits = input.replace(/0x/gi, '').replace(/[\s,:]/g, '');
  if (digits.length === 0 || digits.length % 2 !== 0 || /[^0-9a-f]/i.test(digits)) return undefined;
  const out = new Uint8Array(digits.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(digits.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * A JavaScript literal for a value, as it would be typed in source: used to
 * show the exact arguments of a library call. Long arrays are summarised.
 */
export function literal(value: unknown): string {
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (typeof value === 'number' || typeof value === 'boolean' || value === undefined || value === null) return String(value);
  if (value instanceof Uint8Array) return value.length <= 8 ? `Uint8Array.of(${Array.from(value).join(', ')})` : `/* ${value.length} bytes */ bytes`;
  if (value instanceof Date) return `new Date('${value.toISOString()}')`;
  if (Array.isArray(value)) {
    if (value.length > 3) return `/* ${value.length} colors */ colors`;
    return `[${value.map(literal).join(', ')}]`;
  }
  if (isRecord(value)) {
    const parts = Object.entries(value).filter(([, v]) => v !== undefined).map(([key, v]) => `${key}: ${literal(v)}`);
    return parts.length ? `{ ${parts.join(', ')} }` : '{}';
  }
  return String(value);
}

/** Pretty-prints a decoded result. BigInt, Date and byte arrays are shown readably. */
export function pretty(value: unknown, indent = ''): string {
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === undefined) return 'undefined';
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Uint8Array) return `<${value.length} bytes: ${hex(value.subarray(0, 24))}${value.length > 24 ? ' …' : ''}>`;
  if (value instanceof Date) return value.toISOString();
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const flat = value.every((item) => isRecord(item) && !Array.isArray(item) && Object.values(item).every((v) => typeof v === 'number'));
    const items = value.map((item) => (flat && isRecord(item)
      ? `{ ${Object.entries(item).map(([k, v]) => `${k}: ${String(v)}`).join(', ')} }`
      : pretty(item, inner)));
    return `[\n${items.map((item) => inner + item).join(',\n')}\n${indent}]`;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([key, v]) => `${inner}${key}: ${pretty(v, inner)}`).join(',\n')}\n${indent}}`;
  }
  return String(value);
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
