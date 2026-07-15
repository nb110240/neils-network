function relativeLuminance(hexColor: string): number {
  const normalized = hexColor.replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return 1

  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(normalized.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first)
  const secondLuminance = relativeLuminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

export function getAccessibleTextColor(background: string): "#ffffff" | "#0c0a09" {
  const white = "#ffffff"
  const dark = "#0c0a09"
  return contrastRatio(background, white) >= contrastRatio(background, dark) ? white : dark
}
