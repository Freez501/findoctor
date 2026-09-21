# Handoff Report: Architecture Design & System Environment Investigation

**Author**: `teamwork_preview_explorer_1`  
**Date**: 2026-09-17  
**Working Directory**: `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_1`  
**Target Milestone**: Unified Fullstack TypeScript Architecture, Dev Runner, and Repository Pattern

---

## 1. Observation

### 1.1 Operating System & Toolchain Probing
We directly probed the host system using shell commands in PowerShell on Windows:

- **Command**: `node -v`
  - **Output**: `v24.20.0`
- **Command**: `npm -v` (when run directly in PowerShell)
  - **Error output**:
    ```
    npm : Невозможно загрузить файл C:\Users\Freez\AppData\Local\Programs\nodejs\npm.ps1, так как выполнение сценариев отключено в этой системе. (PSSecurityException, UnauthorizedAccess)
    ```
- **Command**: `npm.cmd -v`
  - **Output**: `11.19.0`
  - **Status**: Exited with code 0.
- **Command**: `npx.cmd --package typescript tsc --version`
  - **Output**:
    ```
    npm warn exec The following package was not found and will be installed: typescript@7.0.2
    Version 7.0.2
    ```
  - **Status**: Exited with code 0.
- **Command**: `git --version`
  - **Output**: `git version 2.55.0.windows.3`

### 1.2 File & Repository Context
- **Root Directory (`c:/Users/Freez/.../Truespace`)**:
  - `ORIGINAL_REQUEST.md`: Defines system requirements (R1: 5 accounts, R2: 5-second mobile input, R3: margin analytics and transaction history, R4: scalable TypeScript architecture with Supabase readiness).
  - `AGENTS.md`: Mandates single-command dev runner (`npm run dev`), mobile-first responsive layout (375px to 1440px), Russian language formatting (`DD.MM.YYYY`, 24-hour time, rubles `₽`), local network preview capability (`--host` for LAN IP testing), and zero extraneous bloat.
  - `PROJECT.md`: Status is `in_progress`, stack chosen as React + TypeScript + Node.js (Vite frontend, Express backend, Supabase-compatible schema).
  - `docs/core/PORTABILITY.md`: Requires clean dependency locking, engines compatibility, and verifiable commands in `README.md`.

---

## 2. Logic Chain

### 2.1 Host Environment & Script Execution Logic
1. **Observation 1.1** demonstrates that Node.js `v24.20.0` and npm `11.19.0` are installed and operational.
2. However, Windows PowerShell defaults to restricting unsigned `.ps1` scripts (`PSSecurityException`), which intercepts plain `npm` and `npx` calls targeting `npm.ps1`.
3. Invoking `npm.cmd` and `npx.cmd` directly bypasses the PowerShell execution policy without requiring administrative system changes.
4. When scripts are launched inside `package.json` (e.g. `npm run dev`), npm spawns subprocesses through `cmd.exe` or Node directly, so internal scripts run seamlessly.
5. Therefore, documentation and setup instructions must explicitly advise developers on Windows PowerShell to use `npm.cmd` if standard execution policy warnings occur.

### 2.2 Unified TypeScript Project Architecture Logic
1. **Observation 1.2** requires a unified TypeScript project covering both React frontend and Express backend.
2. A multi-package monorepo (Lerna/Turborepo/npm workspaces) introduces unnecessary complexity on Windows (symlink issues, nested `node_modules`, elevated startup latency, and dual dependency trees).
3. A **Single Integrated Package Fullstack Architecture** with root `package.json` and a clean separation between `src/client`, `src/server`, and `src/shared` provides:
   - Shared domain models and DTOs in `src/shared` without package linking or build synchronization steps.
   - Shared devDependencies (`typescript`, `vitest`, `tsx`).
   - Single `npm install` for the entire project.
   - A direct Vite proxy in development (`/api` -> `http://localhost:3001`), completely eliminating CORS configuration issues in development.
   - A single production server (`dist/server/index.js`) that serves both the Express API and built Vite assets from `dist/client`, enabling single-port deployment.

### 2.3 Build, Test, and Dev Runner Logic
1. **Observation 1.2** mandates that the app must launch with a single command (`npm run dev`) and compile without errors (`npm run build`).
2. Using `concurrently` allows launching `tsx watch src/server/index.ts` and `vite --host` in parallel with synchronized stdout color-coding.
3. Enabling `--host` on Vite satisfies the requirement in `AGENTS.md` and `docs/runbooks/local-network-preview.md` for opening the app on a mobile phone in the local Wi-Fi network.
4. For testing, `vitest` executes native TypeScript without a pre-compilation step, providing sub-second test runs for financial calculations, balance invariants, and repository operations under `npm test`.

### 2.4 Repository Pattern & Supabase Compatibility Logic
1. Requirement R4 dictates that local storage must work autonomously out-of-the-box, but mirror PostgreSQL / Supabase tables (`accounts`, `events`, `categories`, `transactions`) and allow zero-friction migration to Supabase.
2. By defining an abstraction interface (`IFinanceStore` / `IRepository`), all core business services (`FinanceService`, `AnalyticsService`) interact only with domain contracts.
3. Two local providers are defined:
   - `InMemoryStore`: transient, ideal for deterministic unit tests.
   - `JsonFileStore`: persists to `data/truespace.json`, auto-creates file/directories, ensures persistence across restarts for local workflow without requiring Docker or a local Postgres instance.
4. The tables and schema in local storage match the Supabase SQL schema 1:1, so a `SupabaseStore` implementing `IFinanceStore` via `@supabase/supabase-js` can be plugged in by setting `STORAGE_MODE=supabase` without altering a single line of business logic or UI code.

---

## 3. Detailed Architectural Specifications

### 3.1 Directory Structure
```
Truespace/
├── .env.example                 # Environment variables template
├── .gitignore                   # Ignores node_modules, dist, data/*.json, .env
├── package.json                 # Unified dependencies and scripts
├── tsconfig.json                # Shared TypeScript compiler configuration
├── tsconfig.server.json         # Backend / Node TypeScript configuration
├── vite.config.ts               # Vite configuration with /api proxy & host: true
├── index.html                   # HTML entry point for React
├── data/                        # Local data directory for JSON persistence
│   └── truespace.json           # Local JSON database (auto-generated)
├── src/
│   ├── shared/                  # Zero-dependency shared types and constants
│   │   ├── types.ts             # Domain models (Account, Event, Category, Transaction)
│   │   ├── dto.ts               # Request/Response DTOs and validation schemas
│   │   └── constants.ts         # Account identifiers, category defaults, currency rules
│   │
│   ├── server/                  # Node.js + Express backend
│   │   ├── index.ts             # Server entry point & static asset serving
│   │   ├── app.ts               # Express application builder (isolated for integration testing)
│   │   ├── routes/              # Express API routers
│   │   │   ├── accounts.ts      # /api/accounts
│   │   │   ├── events.ts        # /api/events
│   │   │   ├── categories.ts    # /api/categories
│   │   │   ├── transactions.ts  # /api/transactions
│   │   │   └── analytics.ts     # /api/analytics
│   │   ├── services/            # Business & Financial engine
│   │   │   ├── FinanceService.ts    # Balance calculation, double-entry verification
│   │   │   └── AnalyticsService.ts  # Event margin, revenue, direct expense calculation
│   │   ├── storage/             # Repository Pattern implementations
│   │   │   ├── interfaces.ts    # IFinanceStore, IAccountRepo, ITransactionRepo, etc.
│   │   │   ├── factory.ts       # Storage factory (memory | json | supabase)
│   │   │   ├── InMemoryStore.ts # Ephemeral in-memory store
│   │   │   ├── JsonFileStore.ts # Local file persistence at data/truespace.json
│   │   │   └── SupabaseStore.ts # Ready-to-wire Supabase client adapter
│   │   └── data/
│   │       ├── seed.ts          # Pre-seeded demo accounts, categories, and events
│   │       └── supabase.sql     # Ready-to-execute PostgreSQL DDL for Supabase
│   │
│   └── client/                  # React + Vite frontend
│       ├── main.tsx             # React DOM root
│       ├── App.tsx              # Top-level shell with mobile navigation
│       ├── components/          # Reusable UI components
│       │   ├── accounts/        # Account balance cards & summary strip
│       │   ├── entry/           # 5-second Quick Input form (type, amount, account, category, event)
│       │   ├── analytics/       # Event margin cards, revenue vs direct expense bar
│       │   ├── history/         # Transaction table with filters and cancel/delete action
│       │   └── common/          # Badges, numeric keypad/input, modal, toast
│       ├── hooks/               # State management & data fetching hooks
│       │   ├── useAccounts.ts
│       │   ├── useTransactions.ts
│       │   ├── useEvents.ts
│       │   └── useAnalytics.ts
│       ├── services/            # Frontend API client
│       │   └── api.ts           # Typed fetch wrapper calling /api/*
│       └── styles/              # Design system tokens
│           ├── tokens.css       # Colors, spacing, radii, typography (Russian localization)
│           └── index.css        # Global CSS, mobile viewport resets
│
└── tests/                       # Unit & Integration Tests
    ├── unit/
    │   ├── finance.test.ts      # Financial core: income, expense, transfer invariants
    │   ├── margin.test.ts       # Margin calculations: net profit, margin %, categories
    │   └── storage.test.ts      # Repository operations (create, filter, soft-delete)
    └── integration/
        └── api.test.ts          # Supertest against Express endpoints
```

---

### 3.2 Database Schema & Repository Interfaces (Supabase Compatible)

#### PostgreSQL / Supabase DDL (`src/server/data/supabase.sql`):
```sql
-- 1. Accounts Table (5 pre-defined accounts)
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('cash', 'bank', 'card')),
    description TEXT,
    initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Events Table (Catering events with margin tracking)
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    event_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'completed', 'cancelled')) DEFAULT 'active',
    budget NUMERIC(12, 2) DEFAULT 0.00,
    guest_count INTEGER DEFAULT 0,
    location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Categories Table (Income & Expense categories)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
    color TEXT NOT NULL DEFAULT '#64748b',
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Transactions Table (Income, Expense, Transfer)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
    category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
    event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
    description TEXT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Shared TypeScript Domain Models (`src/shared/types.ts`):
```typescript
export type AccountType = 'cash' | 'bank' | 'card';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type EventStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type CategoryType = 'income' | 'expense' | 'both';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  description: string;
  initialBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CateringEvent {
  id: string;
  title: string;
  eventDate: string;
  status: EventStatus;
  budget?: number;
  guestCount?: number;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color: string;
  isSystem: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  accountId: string;          // Source account or primary account
  toAccountId?: string | null; // Destination account for transfers
  categoryId?: string | null;  // Expense/income category
  eventId?: string | null;     // Associated event (null = general bar expense/income)
  description?: string | null;
  transactionDate: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventMarginMetrics {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  revenue: number;
  directExpenses: number;
  netProfit: number;
  marginPercentage: number;
  expensesByCategory: Record<string, number>;
}
```

#### Repository Pattern Interface (`src/server/storage/interfaces.ts`):
```typescript
import { Account, CateringEvent, Category, Transaction, TransactionType } from '../../shared/types';

export interface TransactionFilter {
  accountId?: string;
  eventId?: string;
  type?: TransactionType;
  includeDeleted?: boolean;
}

export interface IFinanceStore {
  // Accounts
  getAccounts(): Promise<Account[]>;
  getAccountById(id: string): Promise<Account | null>;
  updateAccountBalance(id: string, newBalance: number): Promise<Account>;

  // Events
  getEvents(): Promise<CateringEvent[]>;
  getEventById(id: string): Promise<CateringEvent | null>;
  createEvent(event: Omit<CateringEvent, 'createdAt' | 'updatedAt'>): Promise<CateringEvent>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | null>;

  // Transactions
  getTransactions(filter?: TransactionFilter): Promise<Transaction[]>;
  getTransactionById(id: string): Promise<Transaction | null>;
  createTransaction(tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>): Promise<Transaction>;
  softDeleteTransaction(id: string): Promise<Transaction | null>;

  // State maintenance
  resetToSeed(): Promise<void>;
}
```

---

### 3.3 Dev, Build, and Test Configuration

#### `package.json` Scripts & Dependencies:
```json
{
  "name": "truespace",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -k -p \"[{name}]\" -n \"server,client\" -c \"blue.bold,green.bold\" \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:client": "vite",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.5.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "concurrently": "^8.2.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.2",
    "vitest": "^2.0.5"
  }
}
```

#### Vite Configuration (`vite.config.ts`):
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Listens on 0.0.0.0 for LAN preview on mobile per AGENTS.md
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
});
```

---

## 4. Caveats

1. **PowerShell Script Policy**: On Windows machines with restricted execution policies, running `npm` or `npx` directly in PowerShell yields `PSSecurityException`. Running `npm.cmd` and `npx.cmd` works reliably without altering machine-wide security policies.
2. **Supabase In-Cloud Connection**: This handoff specifies local autonomous persistence via `JsonFileStore` (`data/truespace.json`) and `InMemoryStore`. A live Supabase project will require the user's explicit authorization before setting credentials in `.env`, in compliance with `AGENTS.md` rules regarding external services and keys.
3. **Floating Point Rounding in Financial Math**: JavaScript native floats can suffer from binary representation errors (e.g. `0.1 + 0.2 = 0.30000000000000004`). All calculations inside `FinanceService` and `AnalyticsService` must use an integer kopecks representation (`Math.round(amount * 100)`) internally, converted back to 2-decimal rounded numbers for storage and display.

---

## 5. Conclusion

1. **System Environment**: Node.js `v24.20.0` and npm `11.19.0` are available and fully support modern ESM, TypeScript compilation, and concurrent development processes. `npm.cmd` should be referenced in Windows PowerShell contexts.
2. **Project Architecture**: A single integrated package repository with `src/client` (React + Vite), `src/server` (Express + TS), and `src/shared` (types and models) eliminates monorepo configuration friction while guaranteeing end-to-end type safety and rapid prototyping.
3. **Runner Strategy**: `concurrently` provides a seamless single-command workflow (`npm run dev`) that spins up the backend on `:3001` and the frontend on `:5173` with `--host` LAN visibility and automatic `/api` proxying. `vitest run` delivers instant, zero-build testing for financial and API invariants.
4. **Data Persistence**: The Repository Pattern (`IFinanceStore`) with `JsonFileStore` satisfies zero-dependency local execution out-of-the-box, mirrors the Supabase PostgreSQL schema 100%, and guarantees frictionless future connection to Supabase.

---

## 6. Verification Method

To verify these architectural findings independently:

1. **Verify Windows Environment Commands**:
   ```powershell
   node -v
   npm.cmd -v
   npx.cmd --package typescript tsc --version
   ```
   *Expected output*: Node >= 20 (verified v24.20.0), npm >= 10 (verified 11.19.0), TypeScript version string returned without execution policy error.

2. **Verify Port & Network Availability**:
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 3001
   Test-NetConnection -ComputerName localhost -Port 5173
   ```
   *Expected*: Ports 3001 and 5173 should be unoccupied and ready for backend and frontend dev servers.

3. **Verify File Artifacts**:
   Inspect `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_1/handoff.md` to confirm all 5 sections and detailed schema contracts are complete.

4. **Invalidation Conditions**:
   - If Node.js is downgraded below v18 or npm is corrupted.
   - If PowerShell execution policy prevents `cmd.exe` from executing npm processes.
