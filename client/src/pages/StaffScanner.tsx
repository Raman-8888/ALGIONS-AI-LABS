import React, { useState, useEffect } from 'react';
import { Show } from '../types';
import { api, ApiError } from '../api/client';
import { QrCode, CheckCircle2, XCircle, AlertCircle, RefreshCw, Calendar, Clock } from 'lucide-react';

interface ScanResult {
  status: 'SUCCESS' | 'ERROR';
  message: string;
  ticket?: {
    ticketReference: string;
    seatLabel: string;
    category: string;
    validatedAt: string;
  };
  timestamp: string;
}

export const StaffScanner: React.FC = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [selectedShowId, setSelectedShowId] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [validating, setValidating] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const [activeAlert, setActiveAlert] = useState<ScanResult | null>(null);

  useEffect(() => {
    const fetchShows = async () => {
      try {
        const data = await api.shows.list();
        setShows(data);
        if (data.length > 0) {
          setSelectedShowId(data[0]._id);
        }
      } catch (err) {
        console.error('Failed to load shows for scanner', err);
      }
    };
    fetchShows();
  }, []);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim() || !selectedShowId) return;

    setValidating(true);
    setActiveAlert(null);

    const isTokenJwt = tokenInput.includes('.');
    const payload = isTokenJwt
      ? { qrToken: tokenInput.trim(), showId: selectedShowId }
      : { ticketReference: tokenInput.trim(), showId: selectedShowId };

    try {
      const res = await api.tickets.validate(payload);
      const successResult: ScanResult = {
        status: 'SUCCESS',
        message: 'Admission Granted! Ticket verified.',
        ticket: res.ticket,
        timestamp: new Date().toLocaleTimeString(),
      };
      setActiveAlert(successResult);
      setRecentScans((prev) => [successResult, ...prev]);
      setTokenInput('');
    } catch (err: unknown) {
      let errMsg = 'Failed to validate ticket.';
      if (err instanceof ApiError) {
        if (err.status === 409) {
          errMsg = `DOUBLE SCAN REJECTED: Ticket was already validated! ${err.message}`;
        } else {
          errMsg = err.message;
        }
      } else if (err instanceof Error) {
        errMsg = err.message;
      }

      const errorResult: ScanResult = {
        status: 'ERROR',
        message: errMsg,
        timestamp: new Date().toLocaleTimeString(),
      };
      setActiveAlert(errorResult);
      setRecentScans((prev) => [errorResult, ...prev]);
    } finally {
      setValidating(false);
    }
  };

  const selectedShow = shows.find((s) => s._id === selectedShowId);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <span className="px-3 py-1 bg-amber-500/15 text-amber-300 text-xs font-semibold rounded-full uppercase tracking-wider border border-amber-500/30">
          Staff & Auditorium Checkpoint
        </span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">
          Ticket Admission Scanner
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Validate digital HMAC QR passes and prevent duplicate admission in real-time
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Input and Validation */}
        <div className="md:col-span-2 space-y-6">
          {/* Active Show Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Select Active Auditorium Show
            </label>
            <select
              value={selectedShowId}
              onChange={(e) => setSelectedShowId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {shows.map((show) => (
                <option key={show._id} value={show._id}>
                  {show.movie?.title} — {show.theatre?.name} ({show.screen?.name}) [
                  {new Date(show.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]
                </option>
              ))}
            </select>

            {selectedShow && (
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{new Date(selectedShow.startsAt).toLocaleDateString()}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Door window: 30m prior to showtime</span>
                </span>
              </div>
            )}
          </div>

          {/* Validation Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>Scan QR Code or Enter Ticket Reference</span>
            </h3>

            <form onSubmit={handleValidate} className="space-y-4">
              <div>
                <textarea
                  rows={3}
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Paste QR payload token or type reference (e.g. TK-20261112-ABCD12)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={validating || !tokenInput.trim() || !selectedShowId}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm shadow-md transition flex items-center justify-center space-x-2"
              >
                {validating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Token...</span>
                  </>
                ) : (
                  <span>Validate & Admit Patron</span>
                )}
              </button>
            </form>
          </div>

          {/* Live Scanner Result Banner */}
          {activeAlert && (
            <div
              className={`p-6 rounded-2xl border shadow-xl flex items-start space-x-4 animate-fade-in ${
                activeAlert.status === 'SUCCESS'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              {activeAlert.status === 'SUCCESS' ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-10 h-10 text-rose-400 flex-shrink-0" />
              )}
              <div className="flex-grow">
                <div className="text-xl font-extrabold tracking-tight">
                  {activeAlert.status === 'SUCCESS' ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                </div>
                <div className="text-sm mt-1">{activeAlert.message}</div>
                {activeAlert.ticket && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/20 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">Seat:</span>{' '}
                      <strong className="text-white text-base font-bold">
                        {activeAlert.ticket.seatLabel}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Category:</span>{' '}
                      <strong className="text-white">{activeAlert.ticket.category}</strong>
                    </div>
                    <div className="col-span-2 font-mono text-[11px] text-slate-300">
                      Ref: {activeAlert.ticket.ticketReference}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Scan History */}
        <div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Session Validation History ({recentScans.length})
            </h3>

            {recentScans.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-600">
                <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-700" />
                No tickets scanned yet this session.
              </div>
            ) : (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
                {recentScans.map((scan, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border text-xs ${
                      scan.status === 'SUCCESS'
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{scan.status === 'SUCCESS' ? 'PASSED' : 'REJECTED'}</span>
                      <span className="font-mono text-[10px] text-slate-500">{scan.timestamp}</span>
                    </div>
                    {scan.ticket && (
                      <div className="text-white font-semibold mt-1">
                        Seat {scan.ticket.seatLabel} ({scan.ticket.category})
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400 mt-1 truncate">{scan.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

