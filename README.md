# Nike Run Club Activity Exporter (GPX/TCX)

Why I need to do that? Easy response, NRC don't allow to export your data.
This tool allows you to extract your running activities from the internal SQLite database used by the Nike Run Club (NRC) Android app, and export them into `.gpx` or `.tcx` files for import into platforms like **Garmin Connect**, **Strava**, or others.

---

## ✅ Requirements

- [Android Studio](https://developer.android.com/studio)
- [Node.js](https://nodejs.org/) installed (v14+)
- Basic familiarity with `adb` (Android Debug Bridge)

---

## 🚀 Step-by-step guide

### 1. Install Android Studio and launch an emulator

1. Open **Android Studio**.
2. Go to **Device Manager** > **Create Virtual Device**.
3. Choose **Pixel 9** (or similar).
4. Select a system image with:
   - **Google APIs** (⚠️ not "Google Play")
   - ABI: `x86_64` recommended
5. Finish setup and **start the emulator**.
6. Verify it's working:
   ```bash
   adb devices
   ```

> You must use an emulator that supports `adb root`, which means **no Google Play images**.

---

### 2. Download and install the Nike Run Club APK

You can get the APK from [APKMirror](https://www.apkmirror.com/):

▶️ This script was tested with this specific version:

[Download Nike Run Club 4.67.0](https://www.apkmirror.com/apk/nike-inc/nike-run-club/nike-run-club-running-coach-4-67-0-release/nike-run-club-running-coach-4-67-0-android-apk-download/?redirected=download_invalid_nonce)

Install it using:

```bash
adb install "com.nike.plusgps_4.67.0-1717488865_minAPI29(arm64-v8a,armeabi-v7a,x86,x86_64)(nodpi)_apkmirror.com.apk"
```

---

### 3. Log in to Nike Run Club and open all activities

- Launch the Nike Run Club app inside the emulator.
- **Log in with your NRC account.**
- 🚨 **Important:** You must manually open each activity from the list to ensure it's downloaded and stored into the local SQLite database.

> Only opened activities will be available for export.

---

### 4. Grant root access to the emulator

Use the helper script to enable root mode:

```bash
./rootDevice.sh
```

This runs:

```bash
adb root
adb remount
```

Which is required to access internal app data.

---

### 5. Download the Nike database

Run the second helper script:

```bash
./download_database.sh
```

This pulls the SQLite database file from the emulator:

```bash
adb pull /data/data/com.nike.plusgps/databases/com.nike.nrc.room.database
```

---

### 6. Download dependencies

```bash
npm i
```

### 7. Export activities to GPX or TCX

Once you have the database locally, run:

```bash
node nrc2gpx.js
```

or

```bash
node nrc2tcx.js
```

This will create `.gpx` or `.tcx` files for each activity in the `./gpx` or `./tcx` folder.

---

## ℹ️ Notes

- `.gpx` is suitable for most platforms.
- `.tcx` is **recommended for Garmin Connect**, and includes:
  - Duration
  - Distance
  - Max speed
  - Calories

---

## 🛟 Troubleshooting

- If you see `adbd cannot run as root in production builds`, ensure your emulator uses a **Google APIs** image and **not** a Play Store build.
- If your exported `.tcx` file doesn’t upload, make sure:
  - All activity fields (time, distance, etc.) are correctly populated.
  - You’ve opened the activities in the NRC app at least once.

---

## ⚠️ Known Issues

- Notes and Event name is ignored by Garmin Connect, the name will be represented by the city where the event was placed, ex: "Villa Gessell Run"
- bpm is not exported, I don't have activities at NRC with bpm settings.

---

## ❤️ Credits

Created by Enrique Barbeito  
Based on real-world use case exporting NRC data to Garmin.