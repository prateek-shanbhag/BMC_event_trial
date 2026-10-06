# BMC Event Trial

A React + Vite frontend application for the BMC Event Trial project.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (comes with Node.js)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example env file and adjust as needed:

```bash
cp .env.example .env.local
```

### 3. Start the development server

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

## Available Scripts

| Script             | Description                           |
| ------------------ | ------------------------------------- |
| `npm run dev`      | Start the Vite development server     |
| `npm run build`    | Build for production                  |
| `npm run preview`  | Preview the production build locally  |
| `npm run lint`     | Run ESLint                            |
| `npm run lint:fix` | Run ESLint and auto-fix issues        |
| `npm run format`   | Format code with Prettier             |
| `npm run format:check` | Check formatting without writing  |

## Project Structure

```
src/
├── assets/        # Static assets (images, fonts, etc.)
├── components/    # Reusable UI components
├── hooks/         # Custom React hooks
├── pages/         # Page-level components / routes
├── services/      # API calls and external service integrations
├── utils/         # Utility / helper functions
├── App.jsx        # Root application component
├── App.css        # App-level styles
├── main.jsx       # Application entry point
└── index.css      # Global styles
```

## Tech Stack

- **React 19** — UI library
- **Vite 8** — Build tool and dev server
- **ESLint** — Code linting
- **Prettier** — Code formatting

## License

This project is private.
