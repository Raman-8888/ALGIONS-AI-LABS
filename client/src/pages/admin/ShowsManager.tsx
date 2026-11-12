import React, { useState, useEffect } from 'react';
import { Show, Movie, Theatre, Screen } from '../../types';
import { api, ApiError } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { Plus, Ban, AlertCircle } from 'lucide-react';

export const ShowsManager: React.FC = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [theatres, setTheatres] = useState<Theatre[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [showToCancel, setShowToCancel] = useState<Show | null>(null);
  const [cancelReason, setCancelReason] = useState('Administrative rescheduling');
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [selectedTheatreId, setSelectedTheatreId] = useState('');
  const [selectedScreenId, setSelectedScreenId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [cleaningBuffer, setCleaningBuffer] = useState(15);
  const [vipPrice, setVipPrice] = useState(400);
  const [premiumPrice, setPremiumPrice] = useState(280);
  const [standardPrice, setStandardPrice] = useState(180);

  const fetchData = async () => {
    try {
      const [showList, movieList, theatreList] = await Promise.all([
        api.shows.list(),
        api.movies.list(),
        api.theatres.list(),
      ]);
      setShows(showList);
      setMovies(movieList);
      setTheatres(theatreList);

      if (movieList.length > 0 && !selectedMovieId) setSelectedMovieId(movieList[0]._id);
      if (theatreList.length > 0 && !selectedTheatreId) {
        setSelectedTheatreId(theatreList[0]._id);
        const screenList = await api.screens.list(theatreList[0]._id);
        setScreens(screenList);
        if (screenList.length > 0) setSelectedScreenId(screenList[0]._id);
      }
    } catch (err) {
      console.error('Failed to load shows manager data', err);
      setError('Failed to load shows management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTheatreChange = async (theatreId: string) => {
    setSelectedTheatreId(theatreId);
    try {
      const screenList = await api.screens.list(theatreId);
      setScreens(screenList);
      if (screenList.length > 0) setSelectedScreenId(screenList[0]._id);
    } catch (err) {
      console.error('Failed to load screens for theatre', err);
    }
  };

  const handleCreateShow = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionLoading(true);

    try {
      await api.shows.create({
        movieId: selectedMovieId,
        theatreId: selectedTheatreId,
        screenId: selectedScreenId,
        startsAt: new Date(startsAt).toISOString(),
        cleaningBufferMinutes: cleaningBuffer,
        priceByCategory: {
          VIP: vipPrice * 100, // converted to integer paise
          PREMIUM: premiumPrice * 100,
          STANDARD: standardPrice * 100,
        },
      });

      setIsCreateOpen(false);
      await fetchData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to schedule show.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelShow = async () => {
    if (!showToCancel) return;
    setError(null);
    setActionLoading(true);

    try {
      await api.shows.cancel(showToCancel._id, cancelReason);
      setIsCancelOpen(false);
      setShowToCancel(null);
      await fetchData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to cancel show.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4 mb-8">
        <div>
          <span className="px-3 py-1 bg-indigo-500/15 text-indigo-300 text-xs font-semibold rounded-full uppercase tracking-wider border border-indigo-500/30">
            Showtime Scheduler
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">Shows Manager</h1>
          <p className="text-sm text-slate-400 mt-1">
            Schedule auditorium screenings with overlap serialization & 15m cleaning buffers
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-md transition text-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule New Show</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Shows Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Movie</th>
                <th className="py-3.5 px-4">Theatre & Screen</th>
                <th className="py-3.5 px-4">Showtimes</th>
                <th className="py-3.5 px-4">Buffer</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Prices</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {shows.map((show) => (
                <tr key={show._id} className="hover:bg-slate-850/50 transition">
                  <td className="py-3.5 px-4 font-bold text-white">{show.movie?.title}</td>
                  <td className="py-3.5 px-4">
                    <div>{show.theatre?.name}</div>
                    <div className="text-[11px] text-slate-500">{show.screen?.name}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-white">
                      {new Date(show.startsAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(show.endsAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(show.startsAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono">{show.cleaningBufferMinutes}m</td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={show.status} />
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px]">
                    {Object.entries(show.priceByCategory || {}).map(([c, p]) => (
                      <span key={c} className="mr-2">
                        {c}: ₹{(p / 100).toFixed(0)}
                      </span>
                    ))}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {show.status !== 'CANCELLED' && (
                      <button
                        onClick={() => {
                          setShowToCancel(show);
                          setIsCancelOpen(true);
                        }}
                        className="inline-flex items-center space-x-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 transition"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Show Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Schedule Auditorium Show"
      >
        <form onSubmit={handleCreateShow} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Select Movie
            </label>
            <select
              value={selectedMovieId}
              onChange={(e) => setSelectedMovieId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            >
              {movies.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.title} ({m.durationMinutes}m)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Theatre
              </label>
              <select
                value={selectedTheatreId}
                onChange={(e) => handleTheatreChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              >
                {theatres.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Screen
              </label>
              <select
                value={selectedScreenId}
                onChange={(e) => setSelectedScreenId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              >
                {screens.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.totalSeats} seats)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Cleaning Buffer (mins)
              </label>
              <input
                type="number"
                min={0}
                value={cleaningBuffer}
                onChange={(e) => setCleaningBuffer(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Price By Category (in ₹)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[10px] text-slate-400">VIP</span>
                <input
                  type="number"
                  value={vipPrice}
                  onChange={(e) => setVipPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">PREMIUM</span>
                <input
                  type="number"
                  value={premiumPrice}
                  onChange={(e) => setPremiumPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">STANDARD</span>
                <input
                  type="number"
                  value={standardPrice}
                  onChange={(e) => setStandardPrice(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
            >
              {actionLoading ? 'Scheduling...' : 'Create Show'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cancel Show Modal */}
      <Modal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Cancel Auditorium Show"
      >
        {showToCancel && (
          <div className="space-y-4">
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
              <strong>Cascade Effect Warning:</strong> Cancelling this show will immediately cancel
              all associated confirmed customer bookings, invalidate all digital ticket tokens, and
              initiate 100% automated refunds inside one atomic transaction.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Cancellation Reason
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setIsCancelOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Abort
              </button>
              <button
                onClick={handleCancelShow}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cascade Cancellation'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
