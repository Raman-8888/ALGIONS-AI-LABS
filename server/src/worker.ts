import mongoose from 'mongoose';
import { config } from './common/config/index.js';

async function startWorker() {
  console.log('[Worker] Starting background task runner...');
  try {
    await mongoose.connect(config.mongoUri);
    console.log('[Worker] Connected to MongoDB.');

    // Stub for hold sweeper loop
    console.log(`[Worker] Hold sweeper scheduled with interval ${config.businessRules.holdSweeperIntervalMs}ms`);
  } catch (err) {
    console.error('[Worker] Fatal error:', err);
    process.exit(1);
  }
}

startWorker();

