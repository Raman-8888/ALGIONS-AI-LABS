import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { SeatMapResponse, ShowSeat } from '../types';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CountdownTimer } from '../components/CountdownTimer';
import { ArrowLeft, AlertCircle, CheckCircle2, Info } from 'lucide-react';

export const SeatMap: React.FC = () => {
  const { id: showId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [holdExpiresInSeconds, setHoldExpiresInSeconds] = useState<number | null>(null);

  const fetchSeatMap = useCallback(async () => {
    if (!showId) return;
    try {
      const data = await api.seats.getSeatMap(showId);
      setSeatMap(data);

      // Identify currently held seats by this user
      const myHeldSeats = data.seats.filter((s) => s.isMine && s.status === 'HELD');
      const myHeldIds = myHeldSeats.map((s) => s._id);
      setSelectedSeatIds(myHeldIds);

      // Pick lowest remaining expiration
      if (myHeldSeats.length > 0) {
        const minExpiry = Math.min(
          ...myHeldSeats.map((s) => s.expiresInSeconds || 300)
        );
        setHoldExpiresInSeconds(minExpiry);
      } else {
        setHoldExpiresInSeconds(null);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load seat map.');
      }
    } finally {
      setLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    fetchSeatMap();
  }, [fetchSeatMap]);

  // Handle seat click
  const handleSeatClick = async (seat: ShowSeat) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/shows/${showId}/seats` } } });
      return;
    }

    if (!showId) return;

    // If booked or held by someone else, do nothing
    if (seat.status === 'BOOKED' || (seat.status === 'HELD' && !seat.isMine)) {
      return;
    }

    setError(null);
    setActionLoading(true);

    try {
      if (seat.isMine || selectedSeatIds.includes(seat._id)) {
        // Release seat hold
        await api.holds.release({
          showId,
          seatIds: [seat._id],
        });
        setSelectedSeatIds((prev) => prev.filter((id) => id !== seat._id));
      } else {
        // Hold seat (check max limit 8)
        if (selectedSeatIds.length >= 8) {
          setError('Maximum 8 seats can be held simultaneously per customer.');
          setActionLoading(false);
          return;
        }

        const newBatch = [...selectedSeatIds, seat._id];
        const res = await api.holds.acquire({
          showId,
          seatIds: newBatch,
        });

        setSelectedSeatIds(res.heldSeats);
        setHoldExpiresInSeconds(300); // 5 minutes default hold
      }

      await fetchSeatMap();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setError('Seat just taken by another customer! Please choose another seat.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to update seat selection.');
      }
      // Refresh state on error
      await fetchSeatMap();
    } finally {
      setActionLoading(false);
    }
  };

  const handleHoldExpire = () => {
    setError('Your hold on the seats has expired. Please select your seats again.');
    setSelectedSeatIds([]);
    setHoldExpiresInSeconds(null);
    fetchSeatMap();
  };

  const handleProceedToCheckout = () => {
    if (selectedSeatIds.length === 0) return;
    navigate('/checkout', {
      state: {
        showId,
        seatIds: selectedSeatIds,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!seatMap) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Show Not Found</h2>
        <p className="text-slate-400 mt-1">{error || 'Unable to load seat layout.'}</p>
        <Link to="/" className="mt-4 inline-block px-4 py-2 bg-slate-800 text-slate-200 rounded-lg text-sm">
          Return to Browse
        </Link>
      </div>
    );
  }

  // Calculate selected total price
  const selectedSeatsInfo = seatMap.seats.filter((s) => selectedSeatIds.includes(s._id));
  const totalPricePaise = selectedSeatsInfo.reduce((sum, s) => sum + s.price, 0);

  // Group seats by row
  const rowsMap = new Map<string, ShowSeat[]>();
  seatMap.seats.forEach((seat) => {
    if (!rowsMap.has(seat.row)) {
      rowsMap.set(seat.row, []);
    }
    rowsMap.get(seat.row)!.push(seat);
  });
  const sortedRows = Array.from(rowsMap.keys()).sort();

  const aislesSet = new Set(seatMap.layout.aisles || []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
      {/* Top Navigation & Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4 mb-6">
        <div>
          <Link
            to={`/movie/${showId}`}
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Movie</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">{seatMap.movieTitle}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {seatMap.theatreName} • {seatMap.screenName} •{' '}
            {new Date(seatMap.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {holdExpiresInSeconds && holdExpiresInSeconds > 0 && (
          <div className="self-start sm:self-auto">
            <CountdownTimer initialSeconds={holdExpiresInSeconds} onExpire={handleHoldExpire} />
          </div>
        )}
      </div>

      {/* Alert Banner */}
      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-3 text-rose-400 text-sm animate-shake">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Legend & Price Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-8 flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Status Legend */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded bg-slate-800 border border-slate-600"></div>
            <span className="text-slate-300">Available</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded bg-indigo-600 ring-2 ring-indigo-400"></div>
            <span className="text-indigo-300 font-medium">Selected (You)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded bg-amber-600/80 border border-amber-500"></div>
            <span className="text-amber-300">Held (Others)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded bg-slate-950 border border-slate-850 opacity-40"></div>
            <span className="text-slate-500">Booked</span>
          </div>
        </div>

        {/* Category Prices */}
        <div className="flex items-center space-x-3 text-slate-400 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
          <Info className="w-4 h-4 text-slate-500" />
          {Object.entries(seatMap.priceByCategory).map(([cat, paise]) => (
            <span key={cat}>
              {cat}: <strong className="text-white">₹{(paise / 100).toFixed(0)}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* Cinema Screen Curved Bar */}
      <div className="text-center mb-12">
        <div className="w-3/4 mx-auto h-2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full shadow-[0_0_20px_rgba(99,102,241,0.5)] mb-3"></div>
        <span className="text-[11px] font-bold text-slate-500 tracking-[0.25em] uppercase">
          SCREEN THIS WAY
        </span>
      </div>

      {/* Seat Grid */}
      <div className="overflow-x-auto pb-8">
        <div className="min-w-[600px] flex flex-col items-center space-y-3">
          {sortedRows.map((rowLetter) => {
            const seatsInRow = (rowsMap.get(rowLetter) || []).sort((a, b) => a.column - b.column);
            const rowCategory = seatsInRow[0]?.category || '';

            return (
              <div key={rowLetter} className="flex items-center space-x-2">
                {/* Row Letter & Category Indicator */}
                <div className="w-12 text-right pr-2 flex items-center justify-end space-x-1">
                  <span className="text-xs font-bold text-slate-400">{rowLetter}</span>
                  <span className="text-[9px] text-slate-600 uppercase font-mono">
                    {rowCategory.slice(0, 3)}
                  </span>
                </div>

                {/* Seats */}
                <div className="flex items-center space-x-1.5">
                  {seatsInRow.map((seat) => {
                    const isAisle = aislesSet.has(seat.column);
                    const isSelected = selectedSeatIds.includes(seat._id);
                    const isHeldByOther = seat.status === 'HELD' && !seat.isMine;
                    const isBooked = seat.status === 'BOOKED';

                    return (
                      <React.Fragment key={seat._id}>
                        {isAisle && <div className="w-5"></div>}
                        <button
                          onClick={() => handleSeatClick(seat)}
                          disabled={actionLoading || isBooked || isHeldByOther}
                          title={`${seat.seatLabel} (${seat.category}) - ₹${(seat.price / 100).toFixed(0)}`}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[10px] font-bold transition flex items-center justify-center select-none ${
                            isSelected
                              ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-lg shadow-indigo-600/30'
                              : isHeldByOther
                              ? 'bg-amber-600/80 text-amber-200 border border-amber-500 cursor-not-allowed'
                              : isBooked
                              ? 'bg-slate-950 text-slate-700 border border-slate-900 cursor-not-allowed opacity-40'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-emerald-400 cursor-pointer'
                          }`}
                        >
                          {seat.column}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedSeatIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 shadow-2xl py-4 px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs text-slate-400">
                  Selected Seats ({selectedSeatIds.length}/8 max)
                </div>
                <div className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <span>{selectedSeatsInfo.map((s) => s.seatLabel).join(', ')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="text-right">
                <div className="text-xs text-slate-400">Total Price</div>
                <div className="text-xl font-extrabold text-white">
                  ₹{(totalPricePaise / 100).toFixed(0)}
                </div>
              </div>

              <button
                onClick={handleProceedToCheckout}
                disabled={actionLoading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition duration-150 text-sm"
              >
                Proceed to Checkout →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


