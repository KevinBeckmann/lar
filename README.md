# LTK – Contas da Casa

A dashboard for managing household bills, with **Firebase Firestore real-time sync** for shared items.

---

## Features

- **Contas da Casa** – add, edit, filter, and export monthly bills (stored in localStorage).
- **Itens em tempo real** – a Firestore-backed list that syncs instantly across all open tabs / devices.
  - Add items (text input).
  - Toggle done / edit text and save.
  - Live rendering via `onSnapshot` – no page refresh needed.

---

## Firebase setup

The project uses **Firebase Web SDK v10 (modular, CDN)** — no build step required.

### 1. Create / open the Firebase project

Go to <https://console.firebase.google.com/> and open the **laar-aecef** project
(or create a new one and replace the config in `src/firebase.js`).

### 2. Enable Cloud Firestore

In the Firebase console:

1. **Build → Firestore Database → Create database**.
2. Choose **Start in test mode** (for development) or configure rules manually (see below).
3. Select a region and click **Enable**.

### 3. Firestore security rules (development)

> ⚠️ **Development only — do NOT use in production.**  
> These rules allow **anyone on the internet** to read and write all your data.  
> Before going live, switch to authenticated rules (see below).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;   // ← DEV ONLY, remove before production
    }
  }
}
```

> 🔒 **Production rules** – always require authentication before deploying publicly:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /itens/{itemId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 4. Firebase config

The config is already in `src/firebase.js`. If you use your own project, replace the values:

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT",
  storageBucket:     "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
  measurementId:     "G-XXXXXXXXXX",   // optional
};
```

---

## Running locally

Because the Firebase SDK is loaded via ESM (`type="module"`), the page must be served over HTTP — **not** opened as a `file://` URL.

### Option A – npx serve (no install)

```bash
npx serve .
# open http://localhost:3000
```

### Option B – VS Code Live Server

Install the **Live Server** extension, right-click `index.html` → **Open with Live Server**.

### Option C – Python

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

---

## Project structure

```
├── index.html          # Main page (bills + Firebase itens panel)
├── app.js              # Bills dashboard logic (localStorage)
├── styles.css          # Shared styles
├── sw.js               # Service worker (PWA offline cache)
├── manifest.webmanifest
└── src/
    └── firebase.js     # Firebase init, Firestore helpers, real-time UI
```

---

## How to test the real-time feature

1. Open the app in **two browser tabs** (or share the URL with another device on the same network).
2. Add an item in one tab.
3. The item appears instantly in the other tab — no refresh needed.
4. Edit the text or toggle the checkbox in one tab and click **Salvar**; the change is reflected everywhere.

---

## Analytics

Google Analytics is initialised optionally. If the SDK is blocked (ad-blockers, restricted environments) the app continues to work normally.
