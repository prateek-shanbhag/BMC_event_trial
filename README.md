# BMC Event Trial (Investment Simulation)

A full-stack application utilizing a monorepo structure.

## Repository Structure

```
investment-simulation/
│
├── frontend/      # React + Vite frontend workspace
├── backend/       # Node.js + Express backend workspace
├── docs/          # Project documentation
├── .github/       # GitHub Actions and Issue Templates
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (comes with Node.js)

## Getting Started

This repository uses npm workspaces to manage the `frontend` and `backend` concurrently.

### 1. Install dependencies

Run this command at the root to install dependencies for all workspaces:

```bash
npm install
```

### 2. Configure environment variables

**Frontend Configuration**
In the `frontend/` directory, copy the example environment file:
```bash
cd frontend
cp .env.example .env.local
```
Update `.env.local` with your frontend variables:
- **Frontend-only required variables**: 
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_API_BASE_URL` (e.g., `http://localhost:5000`)

**Backend Configuration**
In the `backend/` directory, copy the example environment file:
```bash
cd backend
cp .env.example .env
```
Update `.env` with your backend variables:
- **Backend required variables**:
  - `PORT` (Optional, defaults to 5000)
  - `FRONTEND_URL` (e.g., `http://localhost:5173`)
  - `GOOGLE_APPLICATION_CREDENTIALS` (Recommended for local development: path to service account JSON key file located outside the repository)
  - `FIREBASE_PROJECT_ID`
  - Or alternatively `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` for inline environments.

**Security Notes on Firebase Credentials & Testing**:
- Service account private keys and credentials must **never** be committed to Git or stored in the repository.
- Use `GOOGLE_APPLICATION_CREDENTIALS` pointing to an external file outside the repository for local development, or standard Application Default Credentials (ADC) in cloud deployment environments.
- All environment files (`.env`, `.env.*`) and credential JSON files are strictly excluded by `.gitignore`.
- For automated testing and destructive script safeguards (`ALLOW_DESTRUCTIVE_TESTS`, `NODE_ENV=test`, `TEST_FIREBASE_PROJECT_ID`, `--confirm-destructive-test`), see [docs/TESTING_SECURITY.md](docs/TESTING_SECURITY.md).

### 3. Start the development servers

To run both frontend and backend concurrently (if you have concurrently installed) or simply start them:

```bash
# Start frontend
npm run dev:frontend

# Start backend
npm run dev:backend
```

## Available Root Scripts

| Script                 | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `npm run dev:frontend` | Start the Vite development server in `frontend/` |
| `npm run dev:backend`  | Start the Nodemon server in `backend/`           |
| `npm run lint`         | Run ESLint in the `frontend/`                    |

## License

This project is private.
