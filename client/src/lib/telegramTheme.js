const DEFAULT_THEME = {
  bg_color: '#17212b',
  secondary_bg_color: '#1f2c38',
  section_bg_color: '#22303d',
  header_bg_color: '#1c2733',
  text_color: '#f5f7fa',
  hint_color: '#8ea2b4',
  link_color: '#64b5f6',
  button_color: '#2ea6ff',
  button_text_color: '#ffffff',
  accent_text_color: '#6ab3ff',
  destructive_text_color: '#ff6b6b'
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

const normalizeHex = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!HEX_RE.test(trimmed)) return null
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
  }
  return trimmed.toLowerCase()
}

const hexToRgb = (value) => {
  const normalized = normalizeHex(value)
  if (!normalized) return null
  const int = Number.parseInt(normalized.slice(1), 16)
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  }
}

const rgbToHex = ({ r, g, b }) => {
  const toHex = (channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const mixHex = (base, target, weight) => {
  const left = hexToRgb(base)
  const right = hexToRgb(target)
  if (!left || !right) return base
  return rgbToHex({
    r: left.r + (right.r - left.r) * weight,
    g: left.g + (right.g - left.g) * weight,
    b: left.b + (right.b - left.b) * weight
  })
}

const withAlpha = (value, alpha) => {
  const rgb = hexToRgb(value)
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

const getLuminance = (value) => {
  const rgb = hexToRgb(value)
  if (!rgb) return 0
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
}

export const applyTelegramTheme = (telegramWebApp) => {
  const params = telegramWebApp?.themeParams || {}

  const bg = normalizeHex(params.bg_color) || DEFAULT_THEME.bg_color
  const secondary = normalizeHex(params.secondary_bg_color) || DEFAULT_THEME.secondary_bg_color
  const section = normalizeHex(params.section_bg_color) || mixHex(bg, '#ffffff', 0.06)
  const header = normalizeHex(params.header_bg_color) || mixHex(bg, '#ffffff', 0.04)
  const text = normalizeHex(params.text_color) || DEFAULT_THEME.text_color
  const hint = normalizeHex(params.hint_color) || DEFAULT_THEME.hint_color
  const link = normalizeHex(params.link_color) || DEFAULT_THEME.link_color
  const button = normalizeHex(params.button_color) || DEFAULT_THEME.button_color
  const buttonText = normalizeHex(params.button_text_color) || DEFAULT_THEME.button_text_color
  const accent = normalizeHex(params.accent_text_color) || mixHex(button, '#ffffff', 0.12)
  const danger = normalizeHex(params.destructive_text_color) || DEFAULT_THEME.destructive_text_color

  const root = document.documentElement
  const isDark = getLuminance(bg) < 0.6
  const panel = isDark ? mixHex(secondary, '#ffffff', 0.04) : mixHex(secondary, '#000000', 0.04)
  const panelStrong = isDark ? mixHex(section, '#ffffff', 0.08) : mixHex(section, '#000000', 0.08)
  const border = isDark ? withAlpha('#ffffff', 0.08) : withAlpha('#000000', 0.1)
  const shadow = isDark ? '0 22px 70px rgba(0, 0, 0, 0.36)' : '0 22px 70px rgba(14, 25, 38, 0.14)'

  const styles = {
    '--tg-bg': bg,
    '--tg-surface': secondary,
    '--tg-section': section,
    '--tg-surface-hover': panel,
    '--tg-surface-elevated': panelStrong,
    '--tg-header': header,
    '--tg-text': text,
    '--tg-gray': hint,
    '--tg-link': link,
    '--tg-button': button,
    '--tg-button-text': buttonText,
    '--tg-accent': accent,
    '--tg-danger': danger,
    '--tg-success': '#49b675',
    '--tg-warning': '#f6b748',
    '--tg-blue-light': button,
    '--tg-blue-dark': mixHex(button, '#000000', 0.26),
    '--tg-border': border,
    '--tg-shadow-strong': shadow,
    '--tg-shadow-soft': isDark ? '0 12px 36px rgba(0, 0, 0, 0.22)' : '0 12px 36px rgba(14, 25, 38, 0.1)',
    '--tg-overlay': isDark ? 'rgba(7, 12, 17, 0.72)' : 'rgba(21, 30, 39, 0.28)',
    '--tg-overlay-strong': isDark ? 'rgba(7, 12, 17, 0.84)' : 'rgba(21, 30, 39, 0.4)',
    '--tg-font-stack': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  }

  Object.entries(styles).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  root.dataset.telegramScheme = isDark ? 'dark' : 'light'

  try {
    telegramWebApp?.setBackgroundColor?.(bg)
    telegramWebApp?.setHeaderColor?.(header)
  } catch {
    // Ignore Telegram client capability mismatches.
  }

  return styles
}
