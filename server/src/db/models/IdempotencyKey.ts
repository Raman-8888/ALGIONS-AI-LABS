import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface IIdempotencyKey extends Document {
  key: string;
  user: Types.ObjectId;
  requestPath: string;
  requestHash: string;
  status: IdempotencyStatus;
  responseStatus?: number;
  responseBody?: any;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const idempotencyKeySchema = new Schema<IIdempotencyKey>(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestPath: {
      type: String,
      required: true,
      trim: true,
    },
    requestHash: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED'],
      default: 'IN_PROGRESS',
      required: true,
    },
    responseStatus: {
      type: Number,
    },
    responseBody: {
      type: Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
  },
);

idempotencyKeySchema.index({ key: 1, user: 1 }, { unique: true });

export const IdempotencyKey: Model<IIdempotencyKey> =
  mongoose.models.IdempotencyKey ||
  mongoose.model<IIdempotencyKey>('IdempotencyKey', idempotencyKeySchema);

