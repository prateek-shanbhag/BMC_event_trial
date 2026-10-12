# Staging Deployment Guide: Firebase Hosting + Render + Firebase

This guide explains how to prepare, deploy, and verify a zero-cost staging environment for the BMC Club Investment Simulation application.

---

## 1. Architecture Overview

- **Frontend**: [Firebase Hosting](https://firebase.google.com/docs/hosting) (Static Single Page Application served over global CDN with automated SSL).
- **Backend**: [Render Free Web Service](https://render.com/docs/web-services) (Node.js/Express REST API with automated health checks).
- **Database & Auth**: Dedicated **Firebase Staging Project** (Cloud Firestore + Firebase Authentication).

```
+-------------------------------------------------------------+
|                     Firebase Staging                        |
|  +--------------------+             +--------------------+  |
|  |  Firebase Hosting  |             | Cloud Firestore &  |  |
|  |   (Frontend SPA)   |             | Firebase Auth      |  |
|  +---------+----------+             +---------^----------+  |
+------------|----------------------------------|-------------+
             | API Requests                     | Admin SDK
             | (Bearer Token)                   | (Cert / Service Acct)
             v                                  |
+-----------------------------------------------+-------------+
|                Render Free Web Service                      |
|                (Node.js / Express API)                      |
|       CORS locked to: https://<staging-app>.web.app         |
+-------------------------------------------------------------+
```

---

## 2. Step 1: Create a Separate Firebase Staging Project

> [!IMPORTANT]
> Always maintain a clean, dedicated Firebase project for staging. Never share credentials, authentication databases, or Firestore collections with production or local testing environments.

1. Navigate to the [Firebase Console](https://console.firebase.google.com/) and click **Add project**.
2. Name the project (e.g. `bmc-investment-staging`).
3. Disable Google Analytics (optional, saves setup time).
4. **Enable Firebase Authentication**:
   - In the sidebar, select **Build > Authentication** and click **Get started**.
   - Under the **Sign-in method** tab, enable **Email/Password** and click **Save**.
5. **Enable Cloud Firestore**:
   - In the sidebar, select **Build > Firestore Database** and click **Create database**.
   - Choose **Start in production mode**.
   - Choose a location closest to your users and Render backend (e.g., `asia-south1` or `asia-southeast1`).
6. **Register the Web App (Frontend)**:
   - Go to **Project Settings** (gear icon) > **General**.
   - Under **Your apps**, click the Web icon (`</>`).
   - Register the app name (e.g. `BMC Staging Web`). Do not check Firebase Hosting setup during this dialog.
   - Copy the configuration object keys (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
7. **Generate Firebase Admin Credentials (Backend)**:
   - Go to **Project Settings > Service accounts**.
   - Select **Firebase Admin SDK** and click **Generate new private key**.
   - Save the downloaded JSON file locally outside of the git repository.
   - Note the three fields needed for Render:
     - `project_id`
     - `client_email`
     - `private_key`

---

## 3. Step 2: Deploy the Backend on Render

1. Log in to [Render](https://dashboard.render.com/).
2. Click **New + > Web Service**.
3. Connect your Git repository.
4. Specify the service settings:
   - **Name**: `bmc-simulation-backend-staging`
   - **Region**: Choose a region near your Firestore location (e.g., Singapore).
   - **Branch**: `main` (or your staging release branch).
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
   - **Health Check Path**: `/api/health`
5. Configure **Environment Variables** in Render's dashboard under **Environment**:

| Environment Variable | Value Example / Description |
| :--- | :--- |
| `FRONTEND_URL` | `https://<your-staging-site>.web.app` (Exact Firebase Hosting staging origin; comma-separated if adding `firebaseapp.com`) |
| `FIREBASE_PROJECT_ID` | Project ID from your staging service account JSON (e.g. `bmc-investment-staging`) |
| `FIREBASE_CLIENT_EMAIL` | Client email from your service account JSON |
| `FIREBASE_PRIVATE_KEY` | Entire private key string including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` |
| `NODE_ENV` | `production` |

> [!CAUTION]
> Render secret environment variables must only be configured in the Render Dashboard. Never commit service account private keys or `.env` files into source control.

6. Click **Create Web Service**.
7. Once deployment finishes and status shows **Live**, copy your public service URL:
   `https://<your-render-service>.onrender.com`

---

## 4. Step 3: Deploy Frontend to Firebase Hosting

### 1. Configure Frontend Build Environment

In your local environment, set the staging environment values in `frontend/.env`:

```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="bmc-investment-staging.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="bmc-investment-staging"
VITE_FIREBASE_STORAGE_BUCKET="bmc-investment-staging.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef"
VITE_API_BASE_URL="https://<your-render-service>.onrender.com"
```

### 2. Build the Frontend Production Bundle

From the repository root:
```bash
npm run build --workspace=frontend
```
Or directly inside the `frontend` folder:
```bash
cd frontend && npm run build
```

This compiles optimized assets into `frontend/dist/`.

### 3. Deploy via Firebase CLI

From the repository root:
```bash
# Log in to Firebase CLI if not already authenticated
npx firebase-tools login

# Select the staging project
npx firebase-tools use --add bmc-investment-staging

# Deploy Firebase Hosting and Firestore Security Rules
npx firebase-tools deploy --only hosting,firestore:rules
```

The CLI outputs your live hosting URL:
`https://bmc-investment-staging.web.app`

---

## 5. Environment Variable Separation Matrix

| Setting | Belongs In | Scope & Sensitivity | Why It's Placed Here |
| :--- | :--- | :--- | :--- |
| `PORT` | Render Dashboard | Server-only / Runtime | Render injects this port dynamically. |
| `FRONTEND_URL` | Render Dashboard | Server-only / Secret settings | Restricts backend CORS strictly to the staging frontend domain. |
| `FIREBASE_PROJECT_ID` | Render Dashboard | Server-only / Secret settings | Identifies Firestore database for Admin SDK operations. |
| `FIREBASE_CLIENT_EMAIL` | Render Dashboard | Server-only / Secret settings | Service account identity for Firebase Admin SDK. |
| `FIREBASE_PRIVATE_KEY` | Render Dashboard | **High Secret** / Never commit | Authorizes backend Admin SDK with full server privileges. |
| `VITE_FIREBASE_*` | Frontend Build (`.env`) | Client-side bundle (Public) | Required by Firebase Client SDK in the user's browser. |
| `VITE_API_BASE_URL` | Frontend Build (`.env`) | Client-side bundle (Public) | Informs client components where to direct API and valuation requests. |

---

## 6. Post-Deployment Verification Checklist

Verify all core flows once both services are deployed:

1. **Backend Health Check**:
   ```bash
   curl https://<your-render-service>.onrender.com/api/health
   # Expected response: {"status":"ok","message":"Backend is healthy"}
   ```

2. **Firebase Admin Connectivity Check**:
   ```bash
   curl https://<your-render-service>.onrender.com/api/health/firebase
   # Expected response: {"status":"ok","message":"Firebase Admin initialized successfully","appName":"[DEFAULT]"}
   ```

3. **CORS Validation**:
   - Open your browser's Developer Tools on `https://<your-staging-site>.web.app`.
   - Ensure network requests to `https://<your-render-service>.onrender.com` succeed with `Access-Control-Allow-Origin: https://<your-staging-site>.web.app`.
   - Verify unlisted origins are blocked with `403 / Not allowed by CORS`.

4. **Authentication & Role Authorization**:
   - Create an admin user document in Firestore (`users/{uid}` with `role: "ADMIN"`, `email`, `name`).
   - Log in through the staging web app. Confirm role verification succeeds and routes appropriately to `/admin` or `/participant`.

5. **Valuation & History Verification**:
   - Ensure Round 0 portfolio valuations return accurately via `/api/admin/portfolios/:teamId/valuation/0`.

6. **Leaderboard Pre-Completion & Post-Completion State**:
   - Before Round 20 finishes, verify the Standings card renders: *"Standings will be available after the simulation finishes."*
   - Verify "Refresh Standings" re-fetches without internal errors.

---

## 7. Operational Warnings & Best Practices

> [!WARNING]
> **Render Free Tier Spin-Down**:
> On Render's Free tier, the web service automatically spins down after **15 minutes of inactivity**. The first incoming request after sleep triggers a cold start that may take **30–50 seconds**. Subsequent requests run at normal speed.

> [!CAUTION]
> **Database Reset & Test Scripts**:
> Never execute `backend/scripts/reset-db.js` or automated test scripts against the staging or production Firestore project. Destructive operations are guarded by `ALLOW_DESTRUCTIVE_TESTS=false` and project ID confirmation. Staging data must only be managed via official Admin endpoints.
