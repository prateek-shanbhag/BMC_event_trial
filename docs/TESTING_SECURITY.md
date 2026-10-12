# Testing Security & Credential Isolation Guide

This document outlines credential configuration, secret protection, and mandatory safety guards for test and reset scripts in the BMC Simulation platform.

---

## 1. Credential Configuration & Isolation

### Firebase Admin SDK Credentials
- **Never embed or commit service account credentials or private keys.**
- For local development, store your Firebase Admin service account key JSON file **outside the repository** (e.g., in a secure directory in your user home folder).
- Point the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to this external file path:
  ```bash
  export GOOGLE_APPLICATION_CREDENTIALS="/Users/your-user/.config/firebase/service-account.json"
  ```
- In Google Cloud environments (Cloud Run, Compute Engine, App Engine), the backend uses standard Application Default Credentials (ADC).
- The backend startup will cleanly fail if credentials are missing or point to a non-existent file, without exposing secret paths, tokens, or environment variable values in error logs.

---

## 2. Environment Variables for Automated Testing

All test scripts in `backend/scripts/` retrieve credentials from environment variables. Hardcoding API keys, passwords, or emails in test scripts is strictly forbidden.

| Variable Name | Description | Example / Note |
|---|---|---|
| `FIREBASE_WEB_API_KEY` | Firebase Web API key for authentication via identitytoolkit | Set in environment or `backend/.env` |
| `TEST_ADMIN_EMAIL` | Email address for test admin user | `admin@example.com` |
| `TEST_ADMIN_PASSWORD` | Password for test admin user | Secure password |
| `TEST_PARTICIPANT_EMAIL` | Email address for test participant 1 (Team A) | `participant1@example.com` |
| `TEST_PARTICIPANT_PASSWORD` | Password for test participant 1 | Secure password |
| `TEST_PARTICIPANT_2_EMAIL` | Email address for test participant 2 (Team B) | `participant2@example.com` |
| `TEST_PARTICIPANT_2_PASSWORD` | Password for test participant 2 | Secure password |

If any required variable is missing, test scripts will terminate immediately with a clear error indicating which variable is absent.

---

## 3. Mandatory Destructive Script Safety Guards

Any script that resets or deletes Firestore data (`reset-db.js`, `test-e2e.js`, `test-round-transitions.js`, `test-finish-simulation.js`, `test-leaderboard.js`, `run-fresh-simulation-qa.js`) is protected by `testSecurityGuard.js`.

To execute a destructive script or test suite that cleans simulation collections, **all** of the following conditions must be satisfied:

1. **`ALLOW_DESTRUCTIVE_TESTS=true`**: Environment variable must be explicitly set to `"true"`.
2. **`NODE_ENV=test`**: Environment variable must be set to `"test"` (never `"production"`).
3. **`TEST_FIREBASE_PROJECT_ID` Allowlist**: Must match the configured Firebase project ID. If there is any mismatch, the script refuses to run.
4. **`--confirm-destructive-test` CLI Flag**: The script command line must explicitly include this argument:
   ```bash
   node backend/scripts/reset-db.js --confirm-destructive-test
   ```
5. **Collection Protection**: Scripts are strictly blocked from deleting or resetting the `users` or `teams` collections.

---

## 4. Secret Protection Checklist

- `.gitignore` strictly ignores:
  - `.env` and all `.env.*` files (except `.env.example`)
  - All service account key variations (`*service-account*.json`, `*serviceAccount*.json`, `*-firebase-adminsdk-*.json`, `*credential*.json`)
  - Local test credential files (`*test-credentials*`, `*test-credential*`)
- `backend/.env.example` and `frontend/.env.example` contain only variable names and generic placeholders.
- Source code and Git history contain no private key blocks or embedded passwords.
