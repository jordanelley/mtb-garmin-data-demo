// Diverging pair (blue = downhill/cool, red = uphill/warm) and status palette,
// taken from the validated reference palette — see dataviz skill references/palette.md.
export const DIVERGING = {
  light: { down: '#2a78d6', neutral: '#f0efec', up: '#e34948' },
  dark: { down: '#3987e5', neutral: '#383835', up: '#e66767' },
}

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
}

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const lerp = (a, b, t) => a + (b - a) * t

/** Maps a signed gradient % (or any signed value) to a diverging blue<->red color, clamped to +/- domain. */
export function gradientColor(value, domain, mode = 'light') {
  const t = Math.max(-1, Math.min(1, domain === 0 ? 0 : value / domain))
  const { down, neutral, up } = DIVERGING[mode]
  const pole = hexToRgb(t < 0 ? down : up)
  const mid = hexToRgb(neutral)
  const absT = Math.abs(t)
  return rgbToHex({
    r: lerp(mid.r, pole.r, absT),
    g: lerp(mid.g, pole.g, absT),
    b: lerp(mid.b, pole.b, absT),
  })
}
