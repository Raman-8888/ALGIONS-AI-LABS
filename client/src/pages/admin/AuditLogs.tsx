import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../types';
import { api } from '../../api/client';
import { Filter, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { Modal } from '../../components/Modal';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [selectedDetails, setSelectedDetails] = useState<Record<string, unknown> | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.audit.list({
        action: actionFilter || undefined,
        limit: 50,
      });
      setLogs(res.logs);
    } catch (err) {
      console.error('Failed to load audit trail', err);
      setError('Failed to fetch audit log trail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CANCEL') || action.includes('FAILED')) {
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
    if (action.includes('CONFIRM') || action.includes('VALIDATED') || action.includes('CREATE')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    }
    if (action.includes('SWEEP') || action.includes('HOLD')) {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4 mb-8">
        <div>
          <span className="px-3 py-1 bg-indigo-500/15 text-indigo-300 text-xs font-semibold rounded-full uppercase tracking-wider border border-indigo-500/30">
            Immutable Audit Trail
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">
            System Security & Audit Logs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Append-only, sanitized records of administrative changes, ticket redemptions, and system sweeps
          </p>
        </div>

        {/* Action Filter */}
        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none"
            >
              <option value="">All Actions</option>
              <option value="SHOW_CREATED">SHOW_CREATED</option>
              <option value="SHOW_CANCELLED">SHOW_CANCELLED</option>
              <option value="BOOKING_CONFIRMED">BOOKING_CONFIRMED</option>
              <option value="BOOKING_CANCELLED">BOOKING_CANCELLED</option>
              <option value="TICKET_VALIDATED">TICKET_VALIDATED</option>
              <option value="HOLD_EXPIRED_SWEEP">HOLD_EXPIRED_SWEEP</option>
              <option value="USER_LOGGED_IN">USER_LOGGED_IN</option>
            </select>
          </div>

          <button
            onClick={fetchLogs}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Table */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Target</th>
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {logs.map((log) => {
                const actorDisplay =
                  log.actorType === 'USER' && typeof log.actorId === 'object' && log.actorId !== null
                    ? (log.actorId as { email: string }).email
                    : log.actorType;

                return (
                  <tr key={log._id} className="hover:bg-slate-850/50 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md font-mono text-[11px] font-semibold border ${getActionBadgeColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-white">{actorDisplay}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-400">
                        {log.targetType} {log.targetId ? `(#${log.targetId.slice(-6)})` : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {log.ipAddress || 'internal'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {log.details && (
                        <button
                          onClick={() => setSelectedDetails(log.details || null)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
                          title="View Details JSON"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Details JSON Modal */}
      <Modal
        isOpen={!!selectedDetails}
        onClose={() => setSelectedDetails(null)}
        title="Sanitized Audit Payload"
      >
        <pre className="p-4 bg-slate-950 rounded-xl border border-slate-850 text-xs font-mono text-emerald-300 overflow-x-auto max-h-96">
          {JSON.stringify(selectedDetails, null, 2)}
        </pre>
      </Modal>
    </div>
  );
};
