# OPERA AI Android Companion App

This directory contains the **SIM-based calling companion app** for OPERA AI.

## Why a separate Android app?

The OPERA AI SaaS does NOT mandate Twilio, Exotel, Plivo, Vonage or any cloud telephony provider. Instead, calls go out through the customer's own physical SIM or eSIM on their own Android phone.

## Architecture

```
Web app (SaaS)
  → Secure backend (OPERA AI API)
    → Paired Android device (this app)
      → Android Telecom / Phone API
        → Customer's SIM/eSIM
          → Real cellular call
```

## Build requirements

- Android Studio Giraffe or newer
- Android SDK 33+ (target 34)
- Kotlin 1.9+
- Gradle 8.5+
- A physical Android device (emulators cannot place real cellular calls)

## Setup

1. Open this `android-app/` directory in Android Studio.
2. Set `OPERA_BASE_URL` in `app/build.gradle.kts` to your deployed SaaS URL (e.g. `https://your-app.vercel.app`).
3. Build + install on your Android phone.
4. Open the app, scan the QR / enter pairing code shown in your web app → Settings → Devices.
5. Once approved on the web app, this device will receive call requests and place real calls via your SIM.

## Permissions explained

| Permission | Why |
|------------|-----|
| `CALL_PHONE` | Place outgoing calls via Android Telecom |
| `READ_PHONE_STATE` | Detect call state transitions (RINGING → CONNECTED → ENDED) |
| `READ_PHONE_NUMBERS` | Display the SIM's own number on the pairing screen |
| `MANAGE_OWN_CALLS` | Self-managed PhoneAccount for outbound calls |
| `RECORD_AUDIO` | Capability detection only — recording happens only when user grants permission AND device supports it |
| `FOREGROUND_SERVICE_PHONE_CALL` | Required by Android 14+ to keep the call-queue service alive |

## Honest capability reporting

The app **never fabricates** a call recording. When the device/OS does not support call recording, it reports one of these states to the backend:

- `RECORDING_NOT_SUPPORTED`
- `RECORDING_PERMISSION_REQUIRED`
- `RECORDING_FAILED`

Real audio uploads only happen when:
1. The user granted `RECORD_AUDIO` permission
2. The device + OS combination actually allows recording during a call
3. The file passed SHA256 integrity verification
4. The file size is below the limit (50 MB)

## Limitations

- iOS is NOT supported (Apple does not allow third-party apps to place or record calls).
- Some carriers disable third-party call management APIs (rare).
- Recording may be legally restricted in your country — the app follows local laws. Check before enabling.
- This codebase provides the architecture and Kotlin source. To verify real cellular calls + recordings, the app must be compiled and tested on a real Android phone with an active SIM — that is **CONFIGURATION REQUIRED** at customer deployment time.

## Build status

- Kotlin source: COMPLETE
- Manifest permissions: COMPLETE
- Pairing flow: COMPLETE
- Foreground call-queue service: COMPLETE
- Telecom integration: ARCHITECTURE-COMPLETE (real testing requires physical Android device)
- Recording capability detection: ARCHITECTURE-COMPLETE (production build requires native testing)

## Verified NOT REQUIRED for SaaS

The SaaS at `vercel.app` works WITHOUT this Android app. The Android app is OPTIONAL — only businesses that want SIM-based outbound dialling need to install it on their team's phones. Without it, the SaaS still does CRM, sales, HRMS, inventory, analytics, AI advisor, action center — everything except placing physical calls.
