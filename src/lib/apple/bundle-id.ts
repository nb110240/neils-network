/**
 * The iOS app's bundle id. It is the Sign in with Apple client_id for the
 * native flow, so the app (which asks Apple for the code) and the server
 * (which exchanges it) must use this one value. Apple rejects an exchange
 * under any other client_id.
 */
export const APPLE_BUNDLE_ID = "app.savvo"
