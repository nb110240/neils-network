export type PushPlatform = "ios" | "android"

export interface PushMessage {
  title: string
  body: string
  /** Same-origin path the app opens when the notification is tapped. */
  url?: string
  /** Groups related notifications on iOS. */
  threadId?: string
}

export interface PushSendResult {
  sent: number
  failed: number
  /** Tokens the push service says will never work again. */
  deadTokens: string[]
}
