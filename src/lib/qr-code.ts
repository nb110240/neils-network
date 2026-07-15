const SVG_DATA_URI_PREFIX = "data:image/svg+xml;utf-8,"

export function toQrImageSrc(qrCode: string): string {
  if (qrCode.startsWith(SVG_DATA_URI_PREFIX)) {
    const payload = qrCode.slice(SVG_DATA_URI_PREFIX.length)
    return payload.trimStart().startsWith("<")
      ? `${SVG_DATA_URI_PREFIX}${encodeURIComponent(payload)}`
      : qrCode
  }

  if (qrCode.startsWith("data:")) return qrCode
  return `${SVG_DATA_URI_PREFIX}${encodeURIComponent(qrCode)}`
}
