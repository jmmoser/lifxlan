/** Turning the protocol's HSBK into something a screen can show. */
import { hsbToRgb } from '../../../src/index.js';
import type { Color } from '../../../src/index.js';

export type Rgb = readonly [number, number, number];

/** A wire color from human units: degrees, 0..1 saturation and brightness, kelvin. */
export function hsbk(hueDegrees: number, saturation: number, brightness: number, kelvin = 3500): Color {
  return {
    hue: Math.round((((hueDegrees % 360) + 360) % 360) / 360 * 65535),
    saturation: Math.round(Math.min(1, Math.max(0, saturation)) * 65535),
    brightness: Math.round(Math.min(1, Math.max(0, brightness)) * 65535),
    kelvin: Math.round(kelvin),
  };
}

/** The tint of a white light at a color temperature (Tanner Helland's fit). */
export function kelvinToRgb(kelvin: number): Rgb {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = t <= 66 ? 255 : clamp(329.698727446 * (t - 60) ** -0.1332047592);
  const g = t <= 66 ? clamp(99.4708025861 * Math.log(t) - 161.1195681661) : clamp(288.1221695283 * (t - 60) ** -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : clamp(138.5177312231 * Math.log(t - 10) - 305.0447927307);
  return [r, g, b];
}

/**
 * The hue of a color at full brightness: the library's `hsbToRgb` for the
 * saturated part, blended toward the kelvin white as saturation drops (the
 * way a LIFX light mixes its color and white LEDs).
 */
export function tint(c: Color): Rgb {
  const [hr, hg, hb] = hsbToRgb(c.hue, 65535, 65535);
  const [wr, wg, wb] = kelvinToRgb(c.kelvin);
  const s = Math.min(1, Math.max(0, c.saturation / 65535));
  return [wr + (hr - wr) * s, wg + (hg - wg) * s, wb + (hb - wb) * s];
}

/** A CSS color for a swatch: the tint scaled by brightness. */
export function swatch(c: Color): string {
  const [r, g, b] = tint(c);
  const v = Math.min(1, Math.max(0, c.brightness / 65535)) ** 0.6;
  return `rgb(${Math.round(r * v)} ${Math.round(g * v)} ${Math.round(b * v)})`;
}

export const rgba = (rgb: Rgb, alpha: number): string =>
  `rgba(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;

export const degrees = (hue: number): number => Math.round(hue / 65535 * 360);
export const percent = (value: number): number => Math.round(value / 65535 * 100);

/** "120° 100% 80% 3500K" */
export function describeColor(c: Color): string {
  return `${degrees(c.hue)}° ${percent(c.saturation)}% ${percent(c.brightness)}% ${Math.round(c.kelvin)}K`;
}

/** Blends two wire colors, taking the short way around the hue circle. */
export function mix(a: Color, b: Color, t: number): Color {
  let delta = b.hue - a.hue;
  if (delta > 32768) delta -= 65536;
  if (delta < -32768) delta += 65536;
  const lerp = (x: number, y: number) => Math.round(x + (y - x) * t);
  return {
    hue: (Math.round(a.hue + delta * t) + 65536) % 65536,
    saturation: lerp(a.saturation, b.saturation),
    brightness: lerp(a.brightness, b.brightness),
    kelvin: lerp(a.kelvin, b.kelvin),
  };
}

/** `count` colors spread evenly across a list of stops. */
export function gradient(stops: readonly Color[], count: number): Color[] {
  const out: Color[] = [];
  for (let i = 0; i < count; i++) {
    const at = count === 1 ? 0 : (i / (count - 1)) * (stops.length - 1);
    const low = Math.min(stops.length - 1, Math.floor(at));
    const high = Math.min(stops.length - 1, low + 1);
    out.push(mix(stops[low]!, stops[high]!, at - low));
  }
  return out;
}
