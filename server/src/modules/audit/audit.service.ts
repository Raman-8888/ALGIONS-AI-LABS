import { AuditLog } from '../../db/models/AuditLog.js';
import { AuditQueryInput } from './audit.validation.js';

export class AuditService {
  static async listLogs(query: AuditQueryInput) {
    const filter: Record<string, any> = {};

    if (query.entity) {
      filter.entity = query.entity;
    }
    if (query.action) {
      filter.action = query.action;
    }
    if (query.actorType) {
      filter.actorType = query.actorType;
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('actorId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

