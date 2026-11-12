import mongoose, { ClientSession } from 'mongoose';

/**
 * Executes a function inside a MongoDB ACID transaction with automatic retries
 * on TransientTransactionError and WriteConflict (Tier 1 Concurrency).
 */
export async function withTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  const session = await mongoose.startSession();
  let attempt = 0;

  try {
    while (attempt < maxRetries) {
      attempt++;
      try {
        session.startTransaction({
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
        });

        const result = await work(session);

        await session.commitTransaction();
        return result;
      } catch (error: any) {
        if (session.inTransaction()) {
          await session.abortTransaction();
        }

        const isTransient =
          error?.hasErrorLabel?.('TransientTransactionError') ||
          error?.hasErrorLabel?.('UnknownTransactionCommitResult') ||
          error?.code === 112; // WriteConflict

        if (isTransient && attempt < maxRetries) {
          // Jittered backoff: 50ms - 200ms
          const backoffMs = Math.floor(Math.random() * 150) + 50;
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw error;
      }
    }
    throw new Error('Transaction exceeded maximum retry attempts');
  } finally {
    await session.endSession();
  }
}

