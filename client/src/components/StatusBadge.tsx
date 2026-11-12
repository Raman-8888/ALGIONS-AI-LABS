import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStyle = (s: string) => {
    switch (s.toUpperCase()) {
      case 'CONFIRMED':
      case 'VALID':
      case 'SUCCESS':
      case 'AVAILABLE':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'PENDING_PAYMENT':
      case 'HELD':
      case 'SCHEDULED':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'CANCELLED':
      case 'FAILED':
      case 'EXPIRED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'USED':
      case 'BOOKED':
      case 'COMPLETED':
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      case 'RUNNING':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStyle(
        status
      )}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
};

