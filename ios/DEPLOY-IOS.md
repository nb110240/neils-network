# Savvo iOS Deploy Runbook (TestFlight to App Store)

This is the end-to-end runbook to take Savvo from this repo to a TestFlight build
and an App Store submission on your Mac.

Key facts pulled from `capacitor.config.ts` (do not let these drift):

- **appId / bundle id:** `app.savvo`
- **appName:** `Savvo`
- **Model:** `server.url` -> the native WebView loads the live site at
  `https://savvo.app`. The app is a thin native shell around the hosted Next.js
  app, with native plugins (push, share, status bar, haptics) layered on top.
- **Current marketing version:** `0.1.0` (from `package.json`)

Run all commands from the repo root:

```bash
cd "/Users/neilbajaj/ClaudeCode-AI/Neil's Network/neils-network"
```

---

## 0. Prerequisites (one time)

1. **Xcode** (latest from the Mac App Store). Open it once and let it install
   the command line components, then accept the license:

   ```bash
   sudo xcodebuild -license accept
   xcode-select -p   # should print a path inside Xcode.app
   ```

2. **CocoaPods** (Capacitor uses it to install native pods):

   ```bash
   brew install cocoapods
   pod --version     # confirm it resolves
   ```

3. **Apple Developer Program membership** ($99/year). You need this to sign,
   use Push Notifications, and submit to TestFlight / the App Store.
   Sign in at https://developer.apple.com and https://appstoreconnect.apple.com.

4. **Register the bundle id** in the Apple Developer portal so it matches
   `capacitor.config.ts`:
   - Go to Certificates, Identifiers & Profiles -> Identifiers -> "+".
   - Type: App IDs -> App.
   - **Bundle ID (explicit):** `app.savvo` (must match `appId` exactly).
   - Enable the capabilities you will use now or later:
     - **Push Notifications** (required for `@capacitor/push-notifications`).
     - **Associated Domains** (only if you use universal links / `appUrlOpen`).
   - Save.

5. **Create the App Store Connect app record** (https://appstoreconnect.apple.com
   -> Apps -> "+"):
   - Platform: iOS.
   - Bundle ID: `app.savvo`.
   - Name: `Savvo` (must be globally unique on the App Store; have a fallback
     ready, e.g. "Savvo - Network CRM").
   - SKU: any internal string, e.g. `savvo-ios`.

---

## 1. Generate the native iOS project

This was deliberately left out of the scaffold because it needs Xcode +
CocoaPods on your machine.

```bash
npx cap add ios
```

This creates the `ios/` Xcode project (this file lives next to it) and runs the
initial pod install. If pods fail, run `cd ios/App && pod install` manually.

> Note: `webDir` is `public` and is only a placeholder. In the `server.url`
> model nothing is bundled from it. If `cap add ios` complains that `public`
> does not exist, create it with `mkdir -p public` (or build the app once) and
> re-run.

---

## 2. Sync native plugins into the iOS project

Run this after `cap add ios` and after **every** time you add/upgrade a
Capacitor plugin or change `capacitor.config.ts`:

```bash
npm run ios:sync     # alias for: cap sync ios
```

`cap sync ios` copies config, installs/updates pods, and wires the installed
plugins (`@capacitor/app`, `push-notifications`, `share`, `status-bar`,
`haptics`) into the native project.

---

## 3. Open the project in Xcode

```bash
npm run ios:open     # alias for: cap open ios
```

This opens `ios/App/App.xcworkspace` in Xcode. **Always open the
`.xcworkspace`, never the `.xcodeproj`** (pods only link via the workspace).

---

## 4. Configure Signing and Capabilities in Xcode

Select the **App** target -> **Signing & Capabilities** tab.

1. **Signing**
   - Check "Automatically manage signing".
   - Team: your Apple Developer team.
   - **Bundle Identifier:** `app.savvo` (must match `capacitor.config.ts`
     `appId` and the registered App ID). Xcode will create the provisioning
     profile for you.

2. **Push Notifications capability**
   - Click "+ Capability" -> add **Push Notifications**.
   - This adds the `aps-environment` entitlement. Capacitor's
     `registerPushNotifications()` depends on it.
   - **APNs key (recommended over certificates):** in the Apple Developer
     portal -> Keys -> "+", enable "Apple Push Notifications service (APNs)",
     download the `.p8` once (you cannot re-download it), and note the Key ID +
     your Team ID. Upload this key to whatever sends your pushes (your backend
     or a provider). The device token flows: APNs -> `@capacitor/push-notifications`
     `registration` event -> your app posts it to the backend
     (`/api/native/push-token`, still a TODO in `src/lib/native/capacitor.ts`).

3. **Background Modes (only if you do background/silent push)**
   - "+ Capability" -> Background Modes -> check "Remote notifications".
   - Skip this if you only send normal user-facing notifications.

4. **Associated Domains (only if you use universal links / `appUrlOpen`)**
   - "+ Capability" -> Associated Domains.
   - Add: `applinks:savvo.app`.
   - This requires an `apple-app-site-association` (AASA) file served at
     `https://savvo.app/.well-known/apple-app-site-association` listing the
     `app.savvo` App ID. Without the AASA file, universal links will not route
     into the app. If you are not doing deep links yet, skip this entirely.

---

## 5. Set the marketing version and build number

Still in the **App** target -> **General** tab (or under Identity):

- **Version (CFBundleShortVersionString):** the marketing version users see,
  e.g. `0.1.0`. Keep this in step with `package.json` `version` (`0.1.0` today).
- **Build (CFBundleVersion):** an integer that must **increase for every upload**
  to App Store Connect, even for the same marketing version. Start at `1`.
  TestFlight rejects a re-upload of an already-used (version, build) pair, so
  bump the build each time.

Tip: you can also set these from the CLI before archiving:

```bash
cd ios/App
xcrun agvtool new-marketing-version 0.1.0   # CFBundleShortVersionString
xcrun agvtool new-version -all 1            # CFBundleVersion
```

---

## 6. Info.plist usage strings (privacy descriptions)

Apple **rejects** apps that trigger a permission prompt without a usage string.
Add only the keys for permissions the app actually requests. Edit
`ios/App/App/Info.plist` (Xcode: right-click Info.plist -> Open As -> Source).

- **Push notifications** do NOT need a usage string (the system prompt has no
  custom copy field). They only need the Push Notifications capability from
  step 4. So if push is your only native permission, you can skip this section.

- **If/when the WebView requests camera** (e.g. a future "scan card" / photo
  feature inside savvo.app):

  ```xml
  <key>NSCameraUsageDescription</key>
  <string>Savvo uses the camera to capture business cards and add contacts faster.</string>
  ```

- **If/when you read the device contact list** (Contacts framework, e.g. a
  native contacts-sync feature). Note: the in-WebView site does not get the
  Contacts framework for free; this is for a future native plugin. The user
  feedback log already asks for phone contacts sync, so this is likely:

  ```xml
  <key>NSContactsUsageDescription</key>
  <string>Savvo can import your phone contacts so you don't have to re-add people you already know.</string>
  ```

- **If/when the WebView uses the photo library** (uploading an avatar):

  ```xml
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Savvo uses your photo library to set contact and profile photos.</string>
  ```

Why these matter: each string is shown verbatim in the iOS permission dialog
and is read by App Review. Vague strings ("This app needs access") get
rejected; explain the user benefit. Do not add keys for permissions you are not
yet requesting, since unused-permission strings also draw reviewer questions.

---

## 7. Build, archive, and validate

1. In Xcode's scheme/destination selector, choose **Any iOS Device (arm64)** as
   the destination (you cannot archive against a simulator).
2. Product -> **Clean Build Folder** (Shift+Cmd+K) the first time.
3. Product -> **Archive**. Wait for the build; the **Organizer** window opens
   when it finishes.
4. In Organizer, select the new archive -> **Validate App**. Fix anything it
   flags (missing icons, entitlement mismatches, bad version/build) before
   uploading.

---

## 8. Upload the build

Pick one path. Xcode Organizer is simplest.

**Option A - Xcode Organizer (recommended):**
- In Organizer, with the validated archive selected, click **Distribute App**.
- Choose **App Store Connect** -> **Upload** -> follow the prompts (let Xcode
  manage signing). The build appears in App Store Connect after processing
  (usually 5-30 minutes).

**Option B - Transporter app:**
- In Organizer, **Distribute App** -> **Export** to produce a `.ipa`.
- Open the **Transporter** app (free, Mac App Store), sign in, drag in the
  `.ipa`, and Deliver.

**Option C - command line (`xcrun altool` / `notarytool` style):**
- Export the `.ipa` as in Option B, then:

  ```bash
  xcrun altool --upload-app -f App.ipa -t ios \
    --apiKey <APP_STORE_CONNECT_KEY_ID> --apiIssuer <ISSUER_ID>
  ```

  (Generate an App Store Connect API key under Users and Access -> Integrations
  -> Keys. `altool` is being superseded; Transporter/Organizer are the durable
  paths.)

---

## 9. TestFlight

1. App Store Connect -> your app -> **TestFlight** tab.
2. Wait for the uploaded build to finish "Processing".
3. Provide **Export Compliance** info (Savvo uses standard HTTPS/TLS, so the
   usual answer is "uses encryption" -> "exempt" under standard exemptions;
   confirm with your own legal stance).
4. **Internal testing:** add yourself / teammates (up to 100 internal testers,
   no review needed) -> they install via the TestFlight app.
5. **External testing** (optional, up to 10,000): create a group, add testers,
   and submit the build for **Beta App Review** (lighter than full review).

Test the full flow on a real device: launch -> WebView loads `https://savvo.app`
-> sign in -> push permission prompt (once wired) -> share sheet -> safe-area
insets clear the notch and home indicator.

---

## 10. App Store submission

1. App Store Connect -> your app -> the version under **Distribution / App
   Store** tab.
2. Fill required metadata: screenshots (per required device sizes), description,
   keywords, support URL, marketing URL, privacy policy URL, category, age
   rating.
3. **App Privacy** questionnaire: declare data collection honestly (Savvo
   collects contact/relationship data and, with push, a device token; account
   data via Supabase). This is mandatory and reviewed.
4. Select the build you uploaded (step 8).
5. Add **App Review notes**: a working demo account (email + password) and a
   short note explaining the native value (see Guideline 4.2 below). Reviewers
   cannot sign up organically, so a demo login is essential.
6. **Submit for Review.**

---

## server.url model implications (read before submitting)

Savvo's iOS app loads `https://savvo.app` live in a native WebView
(`server.url`). Two big consequences:

### Web deploy = app content update (no resubmit)

Because the app renders the live site, **deploying the web app updates the app's
content instantly**. A `vercel --prod` web release changes what users see in the
app with no new build and no App Store review. You only need a new native build
+ resubmission when you change something **native**: a Capacitor plugin, native
permissions/entitlements, `capacitor.config.ts`, the app icon, or the version.

Caveat: never break `https://savvo.app` itself, or you break every installed
app at once. The WebView enforces `cleartext: false` (HTTPS only). The site's
existing CSP applies as-is inside the WebView because the origin is the real
`savvo.app` origin; `X-Frame-Options: DENY` is fine because Capacitor's
`server.url` is a top-level navigation, not an iframe.

### Apple Guideline 4.2 ("Minimum Functionality" / thin-wrapper scrutiny)

Apple rejects apps that are just a website in a WebView with no native value.
Savvo must demonstrably be **more than a repackaged site**. Native features that
justify the app (lean on these in the review notes and make sure at least one is
actually shipping at submission time):

- **Push notifications** (`@capacitor/push-notifications`) - re-engagement that
  a website cannot deliver: "X is going cold", daily digest nudges. This is the
  single strongest 4.2 justification; have it working before submitting.
- **Native share sheet** (`@capacitor/share`) - share a contact / intro via the
  iOS share UI (`shareContact()`), beyond the web share API.
- **Haptics** (`@capacitor/haptics`) - tactile feedback on key actions.
- **Status bar / safe-area integration** (`@capacitor/status-bar` + the
  `env(safe-area-inset-*)` CSS) - true native chrome handling.
- **Biometric unlock** (Face ID / Touch ID) - if/when added, a clear native-only
  capability; strong 4.2 evidence.
- **Universal links / `appUrlOpen`** (Associated Domains) - native deep linking
  if enabled.
- **(Roadmap) native contacts import** - the Contacts framework is native-only
  and directly answers logged user feedback; ship it to remove all 4.2 doubt.

**4.2 mitigation summary:** do not submit a pure pass-through. Have push
notifications live at submission, list the native features above in App Review
notes, and supply a demo account so the reviewer can actually reach the
authenticated experience where the native value shows. If rejected under 4.2,
respond in Resolution Center pointing to the concrete native integrations rather
than resubmitting unchanged.

---

## Native release blockers (resolve before first submission)

These came out of cross-model adversarial review. None affect the web build; all are native-only and any one can break the iOS app or get it rejected. Decide each before you submit.

1. **Auth callback returns to the app (universal links) — CODE IN PLACE.** `public/.well-known/apple-app-site-association` is committed (with a `TEAMID` placeholder) and served as JSON via a `next.config.ts` header. Remaining config (see setup section below): replace `TEAMID` with your Apple Team ID, add the Associated Domains entitlement (`applinks:savvo.app`, `webcredentials:savvo.app`) in Xcode, and smoke-test signup + reset from Mail. MANDATORY for native release: without it, email-link auth opens Safari and leaves the app logged out.

2. **Google sign-in via the system browser — CODE IN PLACE.** The `login` page branches on `isNative()` to `signInWithGoogleNative()` (opens Google in the system browser via `@capacitor/browser`, returns through the `app.savvo://auth/callback` deep link, exchanges the PKCE code). Remaining config: register the `app.savvo` URL scheme in Xcode and add `app.savvo://auth/callback` to the Supabase Auth redirect allowlist.

3. **In-app purchase via RevenueCat — CODE IN PLACE.** The Pro CTA branches on `isNative()` to RevenueCat (`src/lib/native/purchases.ts`); Stripe stays web-only, satisfying Guideline 3.1.1. The webhook at `/api/native/revenuecat-webhook` mirrors entitlements into the `subscriptions` table. Remaining config: create the auto-renewable products in App Store Connect, configure RevenueCat (entitlement `pro`, an offering with monthly + annual packages), set the env vars, and point the RevenueCat webhook at the route.

4. **PostHog analytics blocked by CSP (MEDIUM, pre-existing — verify).** `connect-src` in next.config.ts does not list the PostHog ingestion host (e.g. `https://us.i.posthog.com`), so analytics may be blocked on web AND in the WebView while the privacy label claims PostHog collection. This is a pre-existing web issue, not introduced by the wrapper. Confirm whether PostHog is proxied; if not, add the host to `connect-src` or correct the privacy disclosure.

## Setup: IAP, native Google sign-in, universal links

The app code for all three is committed and the web build is unaffected. These are the remaining account/Xcode/env steps (none can be done from the repo).

### A. Universal links (auth callback returns to the app)

1. In `public/.well-known/apple-app-site-association`, replace both `TEAMID` values with your Apple Developer Team ID, so the appID is `<TeamID>.app.savvo`. Deploy the web app so the file is live at `https://savvo.app/.well-known/apple-app-site-association` (must return 200, `Content-Type: application/json`, no redirect — the `next.config.ts` header handles the type).
2. In Xcode: target → Signing & Capabilities → add **Associated Domains** with `applinks:savvo.app` and `webcredentials:savvo.app`.
3. Supabase: keep the email/reset redirect at `https://savvo.app/auth/callback` (already used). With the AASA live, Mail opens the app instead of Safari.
4. Smoke-test: sign up + reset password on device, tap the email link, confirm it lands in the app authenticated.

### B. Native Google sign-in

1. Xcode: target → Info → URL Types → add a scheme `app.savvo` (CFBundleURLSchemes).
2. Supabase: Auth → URL Configuration → add `app.savvo://auth/callback` to the Redirect URLs allowlist. (No separate Google iOS OAuth client is needed; this reuses your existing Supabase Google provider, just opened in the system browser.)
3. Smoke-test "Continue with Google" on device: the system browser opens, and after consent you return to the app signed in.

### C. In-App Purchase (RevenueCat)

1. App Store Connect: create two auto-renewable subscription products (monthly + annual) under a subscription group; set prices to match web ($5/mo, $50/yr launch).
2. RevenueCat dashboard: add the iOS app, attach the App Store products, create an **entitlement with identifier `pro`**, and an **offering** whose current packages include the monthly and annual products (package types `MONTHLY` and `ANNUAL`).
3. Env vars:
   - `NEXT_PUBLIC_REVENUECAT_IOS_KEY` = the RevenueCat public iOS SDK key (build-time, set in all envs you build native from).
   - `REVENUECAT_WEBHOOK_AUTH` = a random secret; set the same value as the Authorization header in the RevenueCat webhook config.
   - `REVENUECAT_ATTRIBUTE_SECRET` = a random server secret (server-only, do not expose to the client). Enables the signed subscriber attribute below. **REQUIRED before charging real money:** if unset, the defense degrades off (client skips the attribute, webhook skips enforcement) and `app_user_id` alone can grant Pro. Setting it in production is the only thing that closes that gap — treat it as a launch gate, not an optional extra.
4. RevenueCat → Integrations → Webhooks: point at `https://savvo.app/api/native/revenuecat-webhook`, Authorization header = `REVENUECAT_WEBHOOK_AUTH`.
5. Xcode: add the **In-App Purchase** capability.
6. Smoke-test with a Sandbox Apple ID: upgrade flows through the StoreKit sheet, the `pro` entitlement activates, the webhook flips `subscriptions.plan` to `pro`, and "Restore Purchases" works (App Store requires a restore path — surface a Restore button in native account/settings).

> Note: the RevenueCat appUserID is set to the Supabase user id in code, so webhook `app_user_id` maps directly to `subscriptions.user_id`. No DB migration is required (reuses the existing Stripe `subscriptions` table).
>
> Defense in depth: `purchases.ts` fetches an HMAC of the signed-in user id from the authenticated `/api/native/revenuecat-attribute` route and sets it as the `savvo_sig` subscriber attribute, which the webhook recomputes and verifies (`REVENUECAT_ATTRIBUTE_SECRET`) before granting — so `app_user_id` alone (set with the public SDK key) cannot grant Pro.

## Native safe-area polish — WIRED IN CODE, verify on a simulator

This is implemented native-only and does not touch mobile-web layout: `initNative()` sets `viewport-fit=cover` on the viewport meta at runtime (native only), the `body` padding + `.safe-area-inset-*` utilities live in `globals.css`, and the sticky header + full-screen mobile overlay carry the inset classes (the FAB already insets inline). On web `env()` insets are 0, so all of it is inert there.

Remaining: just verify on a notched simulator in BOTH light and dark mode — header clears the status bar, FAB clears the home indicator, no content under the notch, no double-gap. If anything looks off, adjust the `.safe-area-inset-*` placements. Then `npm run ios:sync` and re-archive.

## Native feature wiring (optional, before relying on them)

These plugins are installed and guarded but not yet called from anywhere (by design):
- `registerPushNotifications()` - call after sign-in on native, and implement `/api/native/push-token`.
- `shareContact()` - call it on native where the web share UI currently fires.
- `@capacitor/haptics` - installed for native polish; wire to key interactions or drop it from `package.json`.

## Pre-submission checklist

- [ ] Xcode, CocoaPods (`brew install cocoapods`), Apple Developer membership all in place
- [ ] Bundle id `app.savvo` registered in the Developer portal AND set on the Xcode target
- [ ] App record created in App Store Connect with bundle id `app.savvo`
- [ ] `npx cap add ios` run; `ios/` project exists
- [ ] `npm run ios:sync` run after the latest plugin/config change
- [ ] Signing: team selected, "Automatically manage signing" on, profile generated
- [ ] Push Notifications capability added; APNs `.p8` key created and wired to your sender
- [ ] Push token endpoint (`/api/native/push-token`) implemented and `registerPushNotifications()` actually called on native (currently a TODO)
- [ ] Associated Domains `applinks:savvo.app` added ONLY if AASA file is served (else skip)
- [ ] Version (CFBundleShortVersionString) matches `package.json` (`0.1.0`); Build (CFBundleVersion) incremented vs last upload
- [ ] Info.plist has a clear usage string for every permission actually requested (camera/contacts/photos as applicable); none for permissions not requested
- [ ] App icon set complete; launch screen present
- [ ] Real-device smoke test: WebView loads `https://savvo.app`, sign-in works, safe-area insets correct, push prompt + share sheet work
- [ ] `https://savvo.app` is healthy in production (it IS the app content) and serves over HTTPS
- [ ] Archive **validated** in Organizer with no errors
- [ ] Export Compliance answered in TestFlight
- [ ] App Privacy questionnaire completed honestly (contacts/relationship data, push token, account data)
- [ ] App Review notes include a working demo account + the Guideline 4.2 native-value justification
- [ ] Screenshots, description, keywords, privacy policy URL, support URL all filled
- [ ] Build selected on the version page, then Submit for Review
