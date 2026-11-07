// "Continue with Apple" only works once the Apple provider is enabled in
// Supabase Auth (ios/DEPLOY-IOS.md, Setup D). Until then the button would
// fail for everyone who taps it, so it stays hidden unless this is "true".
// Referenced literally so Next.js inlines it into the client bundle.
const APPLE_SIGN_IN = process.env.NEXT_PUBLIC_APPLE_SIGN_IN

export function appleSignInEnabled(value: string | undefined = APPLE_SIGN_IN): boolean {
  return value?.trim().toLowerCase() === "true"
}
