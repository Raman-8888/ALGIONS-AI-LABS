import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ActorType = 'USER' | 'SYSTEM';

export interface IAuditLog extends Document {
  actorType: ActorType;
  actorId?: Types.ObjectId | null;
  action: string;
  entity: string;
  entityId: string;
  details: Record<string, any>;
  requestId: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorType: {
      type: String,
      enum: ['USER', 'SYSTEM'],
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entity: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    requestId: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Append-only
  },
);

auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

