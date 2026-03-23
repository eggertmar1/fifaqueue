# iOS Guide -- FIFA Queue

This guide covers running the FIFA Queue app on iOS during development, distributing it to testers via TestFlight, and publishing it on the App Store.

---

## Section 1: Running on iOS (Development)

### Prerequisites

1. **macOS** -- iOS development requires a Mac.
2. **Xcode** -- Install from the Mac App Store. After installing, open it once to accept the license and install components:
   ```bash
   sudo xcodebuild -license accept
   xcode-select --install
   ```
3. **Apple Developer Account** -- A free Apple ID works for simulator and personal device testing. For TestFlight/App Store you need a paid account ($99/year). Sign in at Xcode > Settings > Accounts.
4. **Node.js** (v18+) and **npm** -- Verify with:
   ```bash
   node --version
   npm --version
   ```
5. **CocoaPods** -- Required for native iOS dependencies:
   ```bash
   sudo gem install cocoapods
   ```
   Or via Homebrew:
   ```bash
   brew install cocoapods
   ```
6. **Project dependencies installed**:
   ```bash
   cd /path/to/fifa-queue
   npm install
   ```

### Running on the iOS Simulator

Start the Expo dev server targeting iOS:

```bash
npx expo start --ios
```

This will automatically launch the iOS Simulator, build and install the app, and open it.

To pick a specific simulator device:

```bash
npx expo start --ios --device
```

You will see a list of available simulators to choose from.

**Note:** Push notifications do NOT work on the iOS Simulator. You must use a physical device to test push notifications.

### Running on a Physical iPhone via Expo Go

Expo Go is the fastest way to test on a real device but has limitations (no custom native modules).

1. Install **Expo Go** from the App Store on your iPhone.
2. Make sure your iPhone and Mac are on the same Wi-Fi network.
3. Start the dev server:
   ```bash
   npx expo start
   ```
4. Scan the QR code shown in the terminal with your iPhone camera. It will open in Expo Go.

**Limitation:** Expo Go uses a shared bundle identifier, so features like Google OAuth with a custom scheme may not work correctly. For full functionality use a development build (see below).

### Running on a Physical iPhone via Development Build

A development build is a custom version of Expo Go that includes your app's exact native dependencies. This is the recommended approach for full-featured development.

1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. Log in to your Expo account:
   ```bash
   npx eas login
   ```
3. Configure EAS for the project (if not already done):
   ```bash
   npx eas build:configure
   ```
4. Register your iPhone for internal distribution:
   ```bash
   npx eas device:create
   ```
   Follow the prompts. This generates a provisioning profile URL. Open that URL on your iPhone to install the profile, then go to Settings > General > VPN & Device Management to trust it.
5. Build the development client:
   ```bash
   npx eas build --platform ios --profile development
   ```
   This builds in the cloud on EAS servers. It takes several minutes. When done you get a URL to install the app on your registered device.
6. Install the build on your iPhone by opening the provided URL on the device.
7. Start the dev server:
   ```bash
   npx expo start --dev-client
   ```
8. The development build on your phone will connect to your local dev server. Changes will reload automatically.

### Push Notifications

Push notifications **only work on physical iOS devices**. They do not work on the simulator.

The app is already configured with `expo-notifications` in `app.json`. To test:

1. Use a development build on a physical device (see above).
2. Ensure the user grants notification permission when prompted.
3. The Expo push token is device-specific and retrieved at runtime.

### Google OAuth Redirect URI for iOS

The app uses `expo-auth-session` for Google Sign-In. For iOS, configure the redirect URI:

1. The app's URL scheme is defined in `app.json` as `fifa-queue`.
2. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
   - Create an **iOS OAuth client ID**.
   - Set the **Bundle ID** to `com.fifaqueue.app` (matches `app.json`).
3. The redirect URI used by `expo-auth-session` follows the pattern:
   ```
   com.fifaqueue.app:/oauth2redirect
   ```
   For development builds the redirect is handled automatically by `expo-auth-session` using the app's scheme.
4. Set the client ID in your environment:
   ```bash
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

---

## Section 2: TestFlight Distribution

TestFlight is Apple's official beta testing platform. For distributing to 6-10 colleagues, **internal testing** is the simplest option -- it requires no App Store review.

### Prerequisites

- **Apple Developer Program membership** ($99/year). Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/).
- **EAS CLI** installed and logged in (see Section 1).

### Step-by-Step

#### 1. Install and Configure EAS CLI

If you haven't already:

```bash
npm install -g eas-cli
npx eas login
npx eas build:configure
```

The `eas.json` file in the project root is already configured with a `preview` profile for internal distribution.

#### 2. Build for TestFlight

Run the preview build:

```bash
npx eas build --platform ios --profile preview
```

EAS will:
- Prompt you to log in with your Apple Developer account (if not cached).
- Automatically create and manage provisioning profiles and certificates.
- Build the app in the cloud.
- Provide a download link when complete.

For a TestFlight-ready `.ipa` that you submit to App Store Connect, use the production profile instead:

```bash
npx eas build --platform ios --profile production
```

#### 3. Submit to TestFlight

After the build completes, submit it to App Store Connect:

```bash
npx eas submit --platform ios
```

You will be prompted for:
- **Apple ID**: Your Apple Developer account email.
- **ASC App ID**: Your app's App Store Connect ID. Find this at [App Store Connect](https://appstoreconnect.apple.com/) > Your App > General > App Information. It is a numeric ID (e.g., `1234567890`).

To skip the prompts, update `eas.json` with your actual values in the `submit.production.ios` section, then run:

```bash
npx eas submit --platform ios --latest
```

The `--latest` flag automatically selects the most recent build.

#### 4. Create the App in App Store Connect (First Time Only)

Before your first submission, create the app in App Store Connect:

1. Go to [App Store Connect](https://appstoreconnect.apple.com/).
2. Click **My Apps** > **+** > **New App**.
3. Fill in:
   - **Platform**: iOS
   - **Name**: FIFA Queue
   - **Primary Language**: English
   - **Bundle ID**: Select `com.fifaqueue.app` (it appears after your first EAS build creates the identifier).
   - **SKU**: `fifa-queue` (any unique string).
4. Click **Create**.

#### 5. Add Internal Testers

Internal testers are members of your Apple Developer team. They do not require App Store review.

1. In App Store Connect, go to your app.
2. Click the **TestFlight** tab.
3. In the sidebar, click **Internal Testing** > **+** (create a group, e.g., "FIFA Colleagues").
4. Click **+** next to Testers to add people by email.
   - They must be added as **App Store Connect Users** first: go to **Users and Access** in App Store Connect and invite them with the **Developer** or **Marketing** role.
   - Internal testing supports up to 100 testers.
5. Once the build finishes processing (usually 5-15 minutes after upload), enable it for your internal testing group.
6. Testers receive an email invitation to install TestFlight from the App Store and then install your app through TestFlight.

**Key advantage of internal testing:** Builds are available immediately after processing -- no beta app review required. This makes it ideal for a small group of 6-10 colleagues.

#### 6. Updating the TestFlight Build

To push an update:

```bash
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
```

The new build will appear in TestFlight automatically. If auto-distribute is enabled for your testing group, testers are notified of the update.

---

## Section 3: App Store Deployment

### Required Assets

Before submitting for App Store review, prepare the following:

#### App Icon
- Already configured in `app.json` at `./assets/icon.png`.
- Must be 1024x1024 px, no transparency, no rounded corners (Apple adds them automatically).

#### Screenshots
- Required for every device size you support. At minimum:
  - **6.7" display** (iPhone 15 Pro Max / 16 Pro Max): 1290 x 2796 px
  - **6.5" display** (iPhone 14 Plus): 1284 x 2778 px
  - **5.5" display** (iPhone 8 Plus): 1242 x 2208 px (only if supporting older devices)
- Take screenshots using the Simulator:
  ```bash
  xcrun simctl io booted screenshot screenshot.png
  ```
  Or press Cmd+S in the Simulator window.
- Upload 3-10 screenshots per device size in App Store Connect under your app version's media section.

#### Privacy Policy
- **Required by Apple.** Host a privacy policy at a publicly accessible URL (can be a simple web page or GitHub Pages).
- The app collects: Google account info (name, email, profile photo), push notification tokens, and gameplay data (ELO ratings, match history).
- Add the URL in App Store Connect under **App Information** > **Privacy Policy URL**.

#### App Store Metadata
- **App name** and **subtitle** (max 30 characters)
- **Description** (up to 4000 characters)
- **Keywords** (comma-separated, max 100 characters total)
- **Category**: Games or Entertainment
- **Support URL**: A link where users can get help

### Production Build

Build the production version:

```bash
npx eas build --platform ios --profile production
```

This creates an optimized, signed `.ipa` file ready for App Store submission.

### Submit to the App Store

```bash
npx eas submit --platform ios --latest
```

This uploads the build to App Store Connect.

### Prepare for Review in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) > **My Apps** > **FIFA Queue**.
2. Under the **iOS App** section, click the new version and select your build.
3. Fill out all required metadata:
   - Version number (e.g., 1.0.0)
   - Screenshots for each required device size
   - Description, keywords, support URL, privacy policy URL
   - App category
4. Under **App Review Information**, provide:
   - Contact info for the review team (name, phone, email)
   - Demo account credentials if login is required -- provide a test Google account or clear instructions for the reviewer.
   - Notes explaining how the app works and how to test it.
5. Click **Submit for Review**.

### App Store Review: Tips and Common Rejections

**Typical review time:** 24-48 hours, sometimes faster.

**Common rejection reasons and how to avoid them:**

1. **Login/Authentication issues**
   - Provide demo credentials in the review notes. If Google Sign-In is the only option, explain how the reviewer can test it or provide a test account.
   - Consider adding "Sign in with Apple" -- Apple may require this if you offer third-party sign-in. Add it with:
     ```bash
     npx expo install expo-apple-authentication
     ```

2. **Incomplete functionality**
   - Make sure all features work end-to-end. If the queue requires other players, explain in the review notes how the reviewer can test (e.g., "Join the queue and we will have a second tester ready during review hours").

3. **Missing privacy policy**
   - Always include a valid, publicly accessible privacy policy URL.

4. **Push notification justification**
   - Apple may ask why you need push notifications. Explain: "Users receive notifications when the daily FIFA queue opens so they can join and find opponents."

5. **Trademark issues**
   - Do not use "FIFA" in the app name if it could imply official EA/FIFA affiliation. Consider an alternative name like "Foosball Queue" or "Office FIFA" if this causes a trademark rejection.

6. **Crash on launch**
   - Test the production build thoroughly on a physical device before submitting:
     ```bash
     npx eas build --platform ios --profile production
     ```
     Install it on your device and verify all screens work before submitting.

**If your app is rejected:**
- Read the rejection reason carefully in App Store Connect under **Resolution Center**.
- Fix the issue and resubmit. You do not need a new build if the fix is metadata-only.
- For code fixes, build and submit again:
  ```bash
  npx eas build --platform ios --profile production
  npx eas submit --platform ios --latest
  ```
- Reply in Resolution Center if you believe the rejection was a mistake.

### Version Updates

For subsequent releases:

1. Bump the version in `app.json`:
   ```json
   "version": "1.1.0"
   ```
2. Build and submit:
   ```bash
   npx eas build --platform ios --profile production
   npx eas submit --platform ios --latest
   ```
3. In App Store Connect, create a new version, attach the build, update release notes, and submit for review.
