# Research Navigator — دليل الباحث

An Arabic-first AI-powered academic research companion for university students, researchers, and academics. Built with React, TypeScript, Tailwind CSS, Supabase, and Capacitor (Android).

## Features

- **Arabic-first RTL interface** with optional English
- **Supabase authentication** (email/password)
- **Multi-source academic search** (OpenAlex, Crossref, Semantic Scholar, PubMed)
- **AI query expansion** — generates English terminology, synonyms, research questions
- **Paper analysis** — extracts objective, methodology, sample, results, limitations
- **Evidence board** — classify claims as supports/opposes/mixed/insufficient
- **Research gap discovery** — identifies potential gaps linked to sources
- **Research brief** — auto-generated structured Arabic brief with export
- **Research integrity** — checks for unverified sources, overinterpretation, conflicts
- **Context-aware AI assistant** — knows your project's sources and evidence
- **Dark/light/system theme**
- **Android app** via Capacitor

---

## Prerequisites

- **Node.js** 18+ and npm
- **Android Studio** (for Android builds): https://developer.android.com/studio
- **JDK 17+** (bundled with Android Studio)

---

## 1. Install Dependencies

```bash
npm install
```

## 2. Run the Web App (Development)

```bash
npm run dev
```

The app runs on http://localhost:5173

## 3. Build the Web App

```bash
npm run build
```

This produces the `dist/` folder that Capacitor copies into the Android project.

## 4. Sync Capacitor (Web → Android)

After every web build, sync the updated assets into the Android project:

```bash
# Build + sync in one command
npm run cap:sync

# Or manually:
npm run build
npx cap sync android
```

## 5. Open the Android Project

```bash
npm run cap:open
# or: npx cap open android
```

This opens the project in Android Studio. From there you can:
- Run on a connected device or emulator
- Build APKs and AABs
- Configure signing

## 6. Generate a Debug APK

### Option A: Via Android Studio
1. Open the project in Android Studio (`npm run cap:open`)
2. Select **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. The debug APK will be at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Option B: Via Command Line
```bash
cd android
./gradlew assembleDebug
```

The APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a connected device:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## 7. Generate a Signed Release APK

### Step 1: Create a Keystore (one-time)

```bash
keytool -genkey -v -keystore release.keystore -alias research-navigator \
  -keyalg RSA -keysize 2048 -validity 10000
```

Store this file securely. You will need it for every future release update.

### Step 2: Configure Signing in `android/app/build.gradle`

Add a `signingConfigs` block before `buildTypes`:

```gradle
android {
    // ... existing config ...

    signingConfigs {
        release {
            storeFile file('../../release.keystore')
            storePassword 'YOUR_KEYSTORE_PASSWORD'
            keyAlias 'research-navigator'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.release
        }
    }
}
```

### Step 3: Build the Release APK

```bash
cd android
./gradlew assembleRelease
```

The signed APK will be at:
```
android/app/build/outputs/apk/release/app-release.apk
```

## 8. Generate a Signed AAB for Google Play

Google Play requires `.aab` (Android App Bundle) files for new submissions.

### Via Android Studio
1. Open the project in Android Studio
2. Select **Build → Generate Signed Bundle / APK**
3. Choose **Android App Bundle**
4. Select your keystore and enter credentials
5. Choose `release` build type
6. Click **Finish**

### Via Command Line
Make sure signing is configured (see Step 2 above), then:

```bash
cd android
./gradlew bundleRelease
```

The signed AAB will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

Upload this file to the Google Play Console at https://play.google.com/console

---

## Project Structure

```
├── src/                        # React web app source
│   ├── App.tsx                 # Main app with routing & Capacitor back button
│   ├── lib/
│   │   ├── native.ts           # Capacitor plugins (back button, browser, status bar)
│   │   ├── supabase.ts         # Supabase client
│   │   ├── AuthContext.tsx     # Authentication context
│   │   ├── AppContext.tsx      # Language & i18n context
│   │   ├── ThemeContext.tsx    # Dark/light theme context
│   │   ├── api.ts              # Edge function caller
│   │   └── i18n.ts             # Arabic/English translations
│   ├── screens/                # All app screens
│   ├── components/             # Reusable UI components
│   └── types/                  # TypeScript types
├── supabase/
│   ├── config.toml             # Edge function configuration
│   └── functions/              # 7 deployed edge functions
│       ├── academic-search/    # Multi-provider academic search
│       ├── query-expand/       # AI query expansion
│       ├── ai-assistant/       # Context-aware AI chat
│       ├── paper-analysis/     # Paper analysis from abstract
│       ├── evidence-analysis/  # Evidence trend analysis
│       ├── gap-discovery/      # Research gap identification
│       └── brief-generate/     # Research brief generation
├── android/                    # Capacitor Android project
├── capacitor.config.ts         # Capacitor configuration
├── dist/                       # Built web assets (copied to Android)
└── package.json
```

## Capacitor Configuration

- **App ID:** `com.researchnavigator.app`
- **App Name:** Research Navigator
- **Web Dir:** `dist`
- **Plugins:** App (back button), Browser (external URLs), StatusBar, SplashScreen
- **Android Scheme:** `https`
- **Splash screen:** Teal (#0F766E) background, 2 second display
- **Status bar:** Dark style, teal background

## Security

- Supabase keys are in `.env` and are public anon keys (safe for client)
- Service role keys are only used in edge functions (server-side)
- No API keys are exposed in the Android client
- All external API calls go through Supabase edge functions
- RLS policies enforce user data isolation

## Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build web app to `dist/` |
| `npm run typecheck` | TypeScript type checking |
| `npm run cap:sync` | Build + sync to Android |
| `npm run cap:open` | Open Android project in Android Studio |
| `npm run cap:run` | Run app on connected Android device |
| `npm run cap:copy` | Copy web assets to Android without plugin update |

## License

Public — Research Navigator
