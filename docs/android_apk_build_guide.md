# GROWVEST — STEP 10: ANDROID APK BUILD GUIDE

This guide walks you through building the standalone Android `.apk` installer for **Growvest** using Expo Application Services (EAS Build), following the exact pipeline:

```
GitHub
   ↓
Expo/EAS
   ↓
Android build
   ↓
.apk
   ↓
Install directly on Android
```

---

## 1. Why `.apk` instead of `.aab`?

| Format | Extension | Purpose | Direct Phone Installation |
| :--- | :--- | :--- | :--- |
| **Android Package** | `.apk` | Standalone executable package | **Yes — 1-Tap Direct Install** |
| **Android App Bundle** | `.aab` | Google Play Store distribution format | No (Requires Google Play Console) |

Growvest is configured in [`mobile/eas.json`](file:///d:/All%20Websites%20Folders/growvest-app/mobile/eas.json) with:

```json
"android": {
  "buildType": "apk"
}
```

This guarantees EAS outputs a standalone `.apk` file that can be downloaded and installed directly on any Android phone.

---

## 2. Prerequisites

1. **Expo Account**: Create a free account at [https://expo.dev/signup](https://expo.dev/signup) if you don't have one.
2. **EAS CLI**: Install the official Expo Application Services CLI globally:
   ```bash
   npm install -g eas-cli
   ```
3. **Android Device**: Any Android phone running Android 8.0 (Oreo) or newer.

---

## 3. Build Methods

### Method A: EAS Cloud Build (Recommended — No Android Studio Required)

This builds the `.apk` on Expo's high-speed cloud build farm.

1. Navigate to the `mobile` project folder:
   ```bash
   cd mobile
   ```

2. Log in to your Expo account:
   ```bash
   eas login
   ```

3. Link or configure your EAS project (first time only):
   ```bash
   eas project:init
   ```
   *(Select "Create a new project" when prompted)*

4. Trigger the standalone Android APK build:
   ```bash
   eas build --platform android --profile preview
   ```

5. EAS will queue and compile the APK in the cloud. Once complete, the terminal will display:
   - A **QR Code** you can scan directly with your Android camera
   - A **Direct Download Link** (e.g. `https://expo.dev/artifacts/eas/...apk`)

---

### Method B: GitHub Actions (Automated CI/CD)

A production-ready GitHub Actions workflow is provided at [`.github/workflows/build-apk.yml`](file:///d:/All%20Websites%20Folders/growvest-app/.github/workflows/build-apk.yml).

1. Generate an Expo Access Token:
   - Go to [https://expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)
   - Click **Create Token**, label it `GitHub-Actions`, and copy the token.
2. In your GitHub repository:
   - Go to **Settings** > **Secrets and variables** > **Actions**
   - Click **New repository secret**
   - Name: `EXPO_TOKEN`
   - Value: Paste your token and click **Add secret**.
3. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
4. Trigger the build:
   - In GitHub, go to the **Actions** tab.
   - Select **Build Android APK (Growvest)** from the left sidebar.
   - Click **Run workflow** > Select `preview` > Click **Run workflow**.
   - The workflow will build your `.apk` and attach the download link to the job summary!

---

### Method C: Local Android Build (Offline on Your PC)

If you have Android Studio, JDK 17, and Android SDK installed locally on your machine:

```bash
cd mobile
eas build --platform android --profile preview --local
```

The resulting `growvest.apk` will be output directly into your local directory.

---

## 4. Installing the `.apk` Directly on Android

Once the build is finished:

1. **Download the APK**:
   - Open the EAS download URL in your Android phone's browser (e.g. Google Chrome), or scan the terminal QR code.
   - Tap **Download anyway** if prompted with *"File might be harmful"*.

2. **Allow Installation from Unknown Sources**:
   - Tap the downloaded `.apk` file from your notification tray or Downloads folder.
   - If prompted:
     > *"For your security, your phone is currently not allowed to install unknown apps from this source."*
   - Tap **Settings** on the prompt.
   - Toggle **Allow from this source** to **ON**.
   - Tap the back button.

3. **Install & Launch**:
   - Tap **Install**.
   - Tap **Open** when installation finishes.

4. **Verify Native Features**:
   - **Authentication**: Log in or create a new investor account.
   - **Push Notifications**: Grant notification permission when prompted.
   - **Realtime**: Keep the app open while making a status change in the Admin Dashboard to witness 0ms live UI updates!
