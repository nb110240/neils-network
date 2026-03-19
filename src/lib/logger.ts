interface LogContext {
  userId?: string
  action: string
  route?: string
  [key: string]: unknown
}

export function log(level: "info" | "warn" | "error", message: string, context: LogContext) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  }
  if (level === "error") {
    console.error(JSON.stringify(entry))
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry))
  } else {
    console.log(JSON.stringify(entry))
  }
}
