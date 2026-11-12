import mongoose from 'mongoose';
import { app } from './app.js';
import { config } from './common/config/index.js';

let server: ReturnType<typeof app.listen>;

async function startServer() {
  try {
    console.log(`[Database] Connecting to MongoDB...`);
    await mongoose.connect(config.mongoUri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`[Database] Connected successfully to ${mongoose.connection.name}`);

    server = app.listen(config.port, () => {
      console.log(`[Server] API server running on port ${config.port} (${config.env})`);
      console.log(`[Server] Healthcheck: http://localhost:${config.port}/health`);
      console.log(`[Server] API Prefix: http://localhost:${config.port}${config.apiPrefix}`);
    });
  } catch (error) {
    console.error(`[Server] Failed to initialize:`, error);
    process.exit(1);
  }
}

// Graceful shutdown
function gracefulShutdown(signal: string) {
  console.log(`[Server] ${signal} signal received: closing HTTP server...`);
  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        console.log('[Database] MongoDB connection closed cleanly.');
        process.exit(0);
      } catch (err) {
        console.error('[Database] Error closing MongoDB connection:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();

