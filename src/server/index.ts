/**
 * Truespace — Барный кейтеринг и финансы
 * Server Entrypoint (`src/server/index.ts`)
 *
 * Boots the Express REST API server, binds to port 3001 with 0.0.0.0 host for LAN mobile access,
 * and configures graceful shutdown.
 */

import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp();

const server = app.listen(PORT, HOST, () => {
  console.log(`[Server] Truespace Backend running at http://${HOST}:${PORT}`);
  console.log(`[Server] Local API: http://localhost:${PORT}/api`);
  console.log(`[Server] Storage Mode: ${process.env.STORAGE_MODE || 'json'}`);
});

// Graceful shutdown handling
function shutdown(signal: string) {
  console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[Server] HTTP server closed. Process terminating.');
    process.exit(0);
  });

  // Force close after timeout if lingering connections exist
  setTimeout(() => {
    console.error('[Server] Forced shutdown timeout exceeded.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
