# ⚡ Ninja VIP Admin Panel & Cloud License Manager

High-Security Cloud License Authentication Server for **Ninja Aim Assist (8 Ball Pool)**.
Designed for instant zero-config deployment on **Vercel** with complete key duration control, single-device hardware ID (HWID) binding, and automatic expired user lockout.

---

## 🚀 Features

- 🛡️ **Master Admin Key Protection**: Only authenticated admins with the secret master key can access the dashboard. All random/unauthorized keys are instantly rejected.
- ⏱️ **Flexible Duration Control**: Generate licenses for **1 Hour, 1 Day, 3 Days, 7 Days, 30 Days, or Lifetime**. The exact duration configured here is enforced on the Android APK.
- 🚫 **Automatic Hard Lockout on Expiry**: When the time runs out, the APK closes the overlay and kicks the user out with: *"License Expired. Contact Admin for new key."*
- 🔒 **HWID Single-Device Lock**: Keys bind to the player's Android Hardware ID on first activation. Sharing keys across devices is blocked (with 1-click HWID reset for admin).
- ⚡ **Vercel Serverless Ready**: Full support for Vercel edge deployment (`api/validate.js`, `api/keys.js`, `api/auth.js`).

---

## 📦 How to Deploy on Vercel

### Option 1: Using Vercel CLI (Fastest)
1. Open PowerShell / Terminal in this directory:
   ```bash
   cd "ninja-admin-web"
   ```
2. Run Vercel deploy:
   ```bash
   npx vercel --prod
   ```
3. Set your environment variable:
   - `ADMIN_KEY`: `YOUR_SECRET_MASTER_ADMIN_KEY` (Default: `NINJA-ADMIN-SECRET-2026`)

### Option 2: Upload to GitHub & Connect to Vercel
1. Push `ninja-admin-web` to a GitHub repository.
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Import the repository and click **Deploy**.
4. In Project Settings > Environment Variables, add `ADMIN_KEY`.

---

## 🔑 Default Master Admin Key
- **Default Key:** `NINJA-ADMIN-SECRET-2026`
- **Default API Endpoint:** `https://<your-vercel-domain>.vercel.app/api/validate`
