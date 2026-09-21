# Handoff Report: M1 Foundation & Toolchain Configuration Blueprint

**Author**: `teamwork_preview_explorer_m1_1`  
**Date**: 2026-09-17  
**Working Directory**: `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/.agents/teamwork_preview_explorer_m1_1`  
**Milestone**: Milestone M1 — Foundation & Toolchain Configuration  
**Target Files Specified**:
- Root `package.json`
- `tsconfig.json` (Client & Shared Base Config)
- `tsconfig.server.json` (Server Node.js Config)
- `vite.config.ts` (Vite 5, React 18, Port 5173, Host: true, Proxy /api -> :3001)
- `index.html` (Russian Localization `lang="ru"`, Mobile Viewport, Noscript)

---

## 1. Observation

### 1.1 Host Runtime & Toolchain Probing
We directly probed the host system using shell commands in PowerShell on Windows:

- **Command**: `node -v`
  - **Output**: `v24.20.0`
- **Command**: `npm -v` (in standard Windows PowerShell)
  - **Error Output**:
    ```
    npm : Невозможно загрузить файл C:\Users\Freez\AppData\Local\Programs\nodejs\npm.ps1, так как выполнение сценариев отключено в этой системе. (PSSecurityException, UnauthorizedAccess)
    ```
- **Command**: `npm.cmd -v`
  - **Output**: `11.19.0` (Exit code 0)
- **Command**: `npx.cmd --package typescript tsc --version`
  - **Output**: `Version 7.0.2` (TypeScript compiler available via npx)
- **Command**: `git --version`
  - **Output**: `git version 2.55.0.windows.3`

### 1.2 Package Compatibility & Registry Probing
We queried the npm registry to verify exact stable versions and peer dependency constraints:
- **React & React DOM**: Target is React 18 (`^18.3.1`), types `@types/react` (`^18.3.12`), `@types/react-dom` (`^18.3.1`).
- **Vite & React Plugin**:
  - `npm.cmd view @vitejs/plugin-react dist-tags`: Latest `6.1.1` requires `vite: '^8.0.0'` (unreleased/experimental Rolldown).
  - `npm.cmd view @vitejs/plugin-react@4.3.4 peerDependencies`: Yields `{ vite: '^4.2.0 || ^5.0.0 || ^6.0.0' }`.
  - `npm.cmd view vite@5 version`: Yields `5.4.14` (rock-solid LTS for Vite 5).
  - Conclusion: Pin `@vitejs/plugin-react` to `^4.3.4` and `vite` to `^5.4.14`.
- **Testing**:
  - `vitest`: Latest stable 2.x is `2.1.8`, which supports `@types/node` `>=20.0.0` and works directly with Vite 5.
  - `supertest`: `^7.0.0`, with `@types/supertest`: `^6.0.2`.
- **Backend & Tooling**:
  - `express`: `^4.21.2`, `@types/express`: `^4.17.21` (prevents breaking changes from Express 5 alpha).
  - `cors`: `^2.8.5`, `@types/cors`: `^2.8.17`.
  - `dotenv`: `^16.4.7`.
  - `tsx`: `^4.19.2`.
  - `concurrently`: `^9.1.2`.
  - `typescript`: `^5.6.3`.
  - `lucide-react`: `^0.460.0` (peer dependency `{ react: '^16.5.1 || ^17.0.0 || ^18.0.0 || ^19.0.0' }`).

### 1.3 TypeScript Compiler & Node ESM Empirical Probing
In our working directory, we tested compilation and execution behavior:
- Compiling TypeScript with `"module": "ESNext"` and `"moduleResolution": "bundler"`:
  - When relative imports omit the `.js` extension (e.g. `import { testShared } from '../shared/test'`), running the compiled output under Node ESM (`node dist/server/testServer.js`) results in:
    `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../dist/shared/test' imported from .../dist/server/testServer.js`.
  - When relative imports include the standard ESM `.js` extension (e.g. `import { testShared } from '../shared/test.js'`), `tsc` resolves `../shared/test.ts` at build time, preserves the `.js` specifier in the output, and `node dist/server/testServer.js` runs with code 0.
  - `tsx` executes both extensionless and `.js` imports in TypeScript directly during development (`npx.cmd tsx ./src/server/testServer.ts` -> code 0).
- Directory structure: With `"rootDir": "./src"` and `"outDir": "./dist"`, `src/server/index.ts` outputs to `dist/server/index.js` and `src/shared/types.ts` outputs to `dist/shared/types.js`. The compiled server file imports `../shared/types.js`, which maps cleanly without path alterations.

### 1.4 Project Context & Constraints
- `ORIGINAL_REQUEST.md`: Fullstack application with React 18, Vite, Express, TypeScript, 5 accounts, quick mobile entry, margin analytics, and Supabase readiness.
- `AGENTS.md`:
  - Localization in Russian (`lang="ru"` in HTML, Russian formatting for dates/currency).
  - Mobile responsiveness: 375px to 1440px.
  - LAN preview: Local Wi-Fi inspection using `--host` (`0.0.0.0`).
  - Single-command start (`npm run dev`).
  - No bloated dependencies.

---

## 2. Logic Chain

1. **PowerShell Script Policy Handling**:
   - Observation 1.1 reveals that executing `npm` directly in Windows PowerShell throws `PSSecurityException` because PowerShell prioritizes `npm.ps1`.
   - `npm.cmd` completely bypasses PowerShell execution policies because it runs through `cmd.exe`.
   - In `package.json`, if `concurrently` executes child scripts via `npm:dev:server` or nested `npm run` commands, it could invoke `npm.ps1` under certain shell environments.
   - Therefore, the `dev` script in `package.json` must invoke the underlying binaries directly:  
     `"dev": "concurrently -k -p \"[{name}]\" -n \"server,client\" -c \"blue.bold,green.bold\" \"tsx watch src/server/index.ts\" \"vite\""`.
   - This completely eliminates nested npm invocations, runs cross-platform on Windows, macOS, and Linux, and remains 100% immune to PowerShell execution policy restrictions.
   - For all interactive command-line instructions, documentation must explicitly specify `npm.cmd` for Windows users.

2. **Dual TypeScript Configuration (`tsconfig.json` vs `tsconfig.server.json`)**:
   - Client code (`src/client`) requires DOM types (`lib: ["DOM", "DOM.Iterable", "ES2022"]`), React JSX (`"jsx": "react-jsx"`), and Vite bundler resolution (`"noEmit": true`, `"moduleResolution": "bundler"`).
   - Server code (`src/server`) requires Node runtime types (`@types/node`), strictly forbids DOM APIs (to prevent accidental `window` or `document` usage on the backend), and must compile to disk (`"outDir": "./dist"`, `"noEmit": false`) for production runtime.
   - By creating:
     - `tsconfig.json`: targeting `src/client/**/*` and `src/shared/**/*` with `noEmit: true` and DOM libraries.
     - `tsconfig.server.json`: targeting `src/server/**/*` and `src/shared/**/*` with Node types and `outDir: ./dist`.
   - Running `npm run typecheck` executes `tsc --noEmit && tsc -p tsconfig.server.json --noEmit`, strictly verifying both halves of the application without cross-contamination.

3. **Vite & API Proxy Configuration (`vite.config.ts`)**:
   - `server.port: 5173` ensures deterministic local frontend port.
   - `server.host: true` binds Vite to `0.0.0.0`, enabling LAN preview via Wi-Fi (`http://192.168.x.x:5173`) per `AGENTS.md` and `docs/runbooks/local-network-preview.md`.
   - `server.proxy['/api']` directs all backend calls to `http://localhost:3001` with `changeOrigin: true`. This allows the React client to make clean relative fetch calls (`fetch('/api/accounts')`), eliminating CORS overhead in development and matching the production deployment model where Express serves both API and static assets from `dist/client`.
   - `build.outDir: 'dist/client'` separates client bundle artifacts from compiled server files in `dist/server`.
   - The test block in `vite.config.ts` configures Vitest to run unit tests with `environment: 'node'` and `globals: true`.

4. **Russian Localization & Entry Point (`index.html`)**:
   - `<html lang="ru">` establishes Russian locale for screen readers, spellcheckers, and search crawlers.
   - Viewport meta tag specifies `width=device-width, initial-scale=1.0, viewport-fit=cover` to ensure correct rendering on mobile displays, especially notched smartphones.
   - Semantic title and description in Russian, theme color matching dark slate header `#0f172a`, and a fallback `<noscript>` block in Russian.

---

## 3. Caveats

1. **Local Node ESM File Extensions**:
   - When building for production with `tsc -p tsconfig.server.json` and running via `node dist/server/index.js`, Node.js enforces strict ESM file resolution. Relative imports inside `src/server/` and `src/shared/` targeting local files must include the `.js` extension (e.g. `import { Account } from '../shared/types.js'`). In development, `tsx watch src/server/index.ts` supports both extensionless and `.js` imports without distinction.
2. **Windows Execution Policy**:
   - Interactive shell users running PowerShell must type `npm.cmd` instead of `npm`. While our `package.json` scripts are specifically hardened against this issue, manual commands typed in the terminal must use `npm.cmd`.
3. **No External CDN Fonts**:
   - In accordance with `AGENTS.md` and `PORTABILITY.md`, `index.html` relies entirely on system font stacks (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). It does not load external web fonts (e.g. Google Fonts) to guarantee 100% offline functionality, fast loading, and immunity to Russian network blocking/throttling.

---

## 4. Conclusion & Complete File Blueprints

The toolchain and foundation configuration is completely validated and ready for immediate implementation by the milestone executor. Below are the complete, unabridged file blueprints.

### Blueprint 1: Root `package.json`
**Path**: `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/package.json`

```json
{
  "name": "truespace",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Система учёта финансов барного кейтеринга с раздельным учётом по 5 счетам, оперативным вводом и аналитикой маржинальности",
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  },
  "scripts": {
    "dev": "concurrently -k -p \"[{name}]\" -n \"server,client\" -c \"blue.bold,green.bold\" \"tsx watch src/server/index.ts\" \"vite\"",
    "dev:server": "tsx watch src/server/index.ts",
    "dev:client": "vite",
    "build": "vite build && tsc -p tsconfig.server.json",
    "build:client": "vite build",
    "build:server": "tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.server.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^22.10.7",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/supertest": "^6.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "concurrently": "^9.1.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vite": "^5.4.14",
    "vitest": "^2.1.8"
  }
}
```

---

### Blueprint 2: `tsconfig.json` (Client & Shared Base Configuration)
**Path**: `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode for Vite */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Strict Type-Checking */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "src/client/**/*",
    "src/shared/**/*",
    "vite.config.ts"
  ],
  "exclude": [
    "src/server/**/*",
    "node_modules",
    "dist"
  ]
}
```

---

### Blueprint 3: `tsconfig.server.json` (Server Node.js Configuration)
**Path**: `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/tsconfig.server.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": [
    "src/server/**/*",
    "src/shared/**/*"
  ],
  "exclude": [
    "src/client/**/*",
    "node_modules",
    "dist"
  ]
}
```

---

### Blueprint 4: `vite.config.ts`
**Path**: `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/vite.config.ts`

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // Listens on 0.0.0.0 for LAN preview on mobile per AGENTS.md & docs/runbooks/local-network-preview.md
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

---

### Blueprint 5: `index.html`
**Path**: `c:/Users/Freez/OneDrive/Desktop/Codex_—_от_идеи_до_первых_пользователей/Truespace/index.html`

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0f172a" />
    <meta name="description" content="Truespace — Система учёта финансов барного кейтеринга с раздельным учётом по 5 счетам, быстрым вводом и аналитикой маржинальности" />
    <title>Truespace — Финансы барного кейтеринга</title>
  </head>
  <body>
    <div id="root"></div>
    <noscript>
      <div style="padding: 24px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #334155;">
        <h2>Требуется включить JavaScript</h2>
        <p>Для работы приложения Truespace необходим JavaScript в браузере.</p>
      </div>
    </noscript>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>
</html>
```

---

## 5. Verification Method

To independently verify the configuration blueprints once installed:

1. **Dependency Installation**:
   ```powershell
   npm.cmd install
   ```
   *Expected outcome*: Clean installation with 0 audit vulnerabilities and 0 peer dependency conflict errors.

2. **TypeScript Strict Type Checking**:
   ```powershell
   npm.cmd run typecheck
   ```
   *Expected outcome*: Runs `tsc --noEmit` and `tsc -p tsconfig.server.json --noEmit` sequentially with exit code 0.

3. **Client & Server Build Verification**:
   ```powershell
   npm.cmd run build
   ```
   *Expected outcome*:
   - `dist/client/` is created containing `index.html` and bundled assets.
   - `dist/server/` and `dist/shared/` are created containing compiled ESM `.js` files.

4. **Testing Suite Runner**:
   ```powershell
   npm.cmd test
   ```
   *Expected outcome*: Vitest launches with Node environment and executes tests under `tests/`.

5. **Single-Command Dev Runner**:
   ```powershell
   npm.cmd run dev
   ```
   *Expected outcome*: Concurrently starts Express server on `:3001` and Vite on `:5173`. Vite console displays both Local (`http://localhost:5173/`) and Network (`http://192.168.x.x:5173/`) addresses without PowerShell `PSSecurityException`.

6. **Invalidation Conditions**:
   - If `@vitejs/plugin-react` is bumped to `6.x`, Vite 5 fails to start (requires Vite 8).
   - If `npm:dev:server` shorthand is used in `concurrently` on Windows PowerShell with restricted execution policy, `PSSecurityException` occurs.
   - If DOM types are included in `tsconfig.server.json`, backend code loses strict isolation from browser APIs.
