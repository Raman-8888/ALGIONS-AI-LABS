import mongoose, { ClientSession, Types } from 'mongoose';
import { AuditLog, ActorType } from '../../db/models/AuditLog.js';

interface AuditLogParams {
  actorType: ActorType;
  actorId?: Types.ObjectId | string | null;
  action: string;
  entity: string;
  entityId: string;
  details?: Record<string, any>;
  requestId?: string;
  session?: ClientSession;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'jwt',
  'secret',
  'qrtoken',
  'cookie',
  'authorization',
]);

function sanitizeDetails(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDetails(item));
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !(value instanceof Types.ObjectId)) {
      cleaned[key] = sanitizeDetails(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function logAudit({
  actorType,
  actorId,
  action,
  entity,
  entityId,
  details = {},
  requestId = 'system',
  session,
}: AuditLogParams): Promise<void> {
  try {
    const sanitized = sanitizeDetails(details);
    const auditDoc = new AuditLog({
      actorType,
      actorId: actorId ? new Types.ObjectId(actorId.toString()) : null,
      action,
      entity,
      entityId,
      details: sanitized,
      requestId,
    });

    await auditDoc.save({ session });
  } catch (error) {
    // Non-blocking: audit log failure should not crash the main operational path unless in strict mode
    console.error(`[AuditLog Error] Failed to write audit record for action "${action}":`, error);
  }
}

