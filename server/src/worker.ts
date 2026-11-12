import mongoose from 'mongoose';
import { config } from './common/config/index.js';
import { HoldSweeper } from './modules/holds/holdSweeper.js';

let isShuttingDown = false;
let sweepInterval: NodeJS.Timeout;

async function startWorker() {
  console.log('[Worker] Starting background task runner...');
  try {
    await mongoose.connect(config.mongoUri, {
      maxPoolSize: 10,
    });
    console.log(`[Worker] Connected to MongoDB: ${mongoose.connection.name}`);

    const intervalMs = config.businessRules.holdSweeperIntervalMs;
    console.log(`[Worker] Scheduling Hold Sweeper every ${intervalMs}ms...`);

    // Run initial sweep immediately
    await HoldSweeper.sweepExpiredHolds();

    sweepInterval = setInterval(async () => {
      if (isShuttingDown) return;
      try {
        await HoldSweeper.sweepExpiredHolds();
      } catch (err) {
        console.error('[Worker] Error during hold sweep cycle:', err);
      }
    }, intervalMs);
  } catch (err) {
    console.error('[Worker] Fatal initialization error:', err);
    process.exit(1);
  }
}

function shutdown(signal: string) {
  console.log(`[Worker] Received ${signal}. Shutting down worker...`);
  isShuttingDown = true;
  if (sweepInterval) {
    clearInterval(sweepInterval);
  }
  mongoose.connection.close(false).then(() => {
    console.log('[Worker] MongoDB connection closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startWorker();
