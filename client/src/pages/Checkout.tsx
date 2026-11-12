import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { SeatMapResponse, ShowSeat } from '../types';
import { api, ApiError } from '../api/client';
import { CreditCard, ShieldCheck, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as { showId?: string; seatIds?: string[] } | null;
  const showId = state?.showId;
  const seatIds = state?.seatIds || [];

  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulationMode, setSimulationMode] = useState<'MOCK_SUCCESS' | 'MOCK_FAIL' | 'MOCK_TIMEOUT'>('MOCK_SUCCESS');
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [refundNotice, setRefundNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!showId || seatIds.length === 0) {
      navigate('/', { replace: true });
      return;
    }

    const fetchDetails = async () => {
      try {
        const data = await api.seats.getSeatMap(showId);
        setSeatMap(data);
      } catch (err) {
        console.error('Failed to load show details', err);
        setError('Failed to load checkout details.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [showId, seatIds, navigate]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!seatMap) return null;

  const selectedSeats = seatMap.seats.filter((s) => seatIds.includes(s._id));
  const totalPaise = selectedSeats.reduce((sum, s) => sum + s.price, 0);
  const totalRupees = (totalPaise / 100).toFixed(2);

  const handlePayAndConfirm = async () => {
    setError(null);
    setRefundNotice(null);
    setProcessing(true);

    try {
      // 1. Initiate booking (or reuse pending booking if retrying)
      let bookingId = pendingBookingId;
      if (!bookingId) {
        const initiateRes = await api.bookings.initiate({
          showId: showId!,
          seatIds,
        });
        bookingId = initiateRes.booking._id;
        setPendingBookingId(bookingId);
      }

      // 2. Simulate Payment outside DB transaction
      const paymentRes = await api.bookings.simulatePayment({
        bookingId,
        simulationMode,
      });

      if (paymentRes.status === 'FAILED') {
        throw new Error(paymentRes.message || 'Payment simulation failed. You can retry with another mode.');
      }

      // 3. Confirm booking inside ACID transaction
      const confirmRes = await api.bookings.confirm(bookingId, paymentRes.paymentId);

      // 4. Navigate to confirmation page
      navigate(`/confirmation/${bookingId}`, {
        state: {
          booking: confirmRes.booking,
          tickets: confirmRes.tickets,
          movieTitle: seatMap.movieTitle,
          theatreName: seatMap.theatreName,
          screenName: seatMap.screenName,
          startsAt: seatMap.startsAt,
        },
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409 && err.code === 'HOLD_EXPIRED_DURING_PAYMENT') {
          // "Paid but no seat" fallback rule!
          setRefundNotice(
            'Your hold expired while payment was in progress. Your booking has been marked EXPIRED and an automated 100% refund has been queued (status: REFUND_PENDING).'
          );
        } else {
          setError(err.message);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Payment processing encountered an error.');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/shows/${showId}/seats`}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Change Seats</span>
        </Link>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Review & Checkout</h1>
        <p className="text-sm text-slate-400 mt-1">Review your tickets and select payment mode</p>
      </div>

      {refundNotice && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start space-x-3 text-amber-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
          <div>
            <div className="font-bold">Hold Expired During Payment (Auto-Refund Initiated)</div>
            <p className="mt-1 text-slate-300">{refundNotice}</p>
            <Link
              to="/my-bookings"
              className="mt-3 inline-block px-3 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-500/30 transition"
            >
              View in My Bookings →
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Order Summary */}
        <div className="md:col-span-2 space-y-6">
          {/* Show Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Show Details</h3>
            <div className="text-xl font-bold text-white">{seatMap.movieTitle}</div>
            <div className="text-sm text-slate-400 mt-1">
              {seatMap.theatreName} • {seatMap.screenName}
            </div>
            <div className="text-xs text-indigo-400 font-medium mt-2">
              {new Date(seatMap.startsAt).toLocaleString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {/* Seats Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              Selected Seats ({selectedSeats.length})
            </h3>
            <div className="divide-y divide-slate-800">
              {selectedSeats.map((seat: ShowSeat) => (
                <div key={seat._id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold text-white mr-2">Seat {seat.seatLabel}</span>
                    <span className="text-xs text-slate-500">({seat.category})</span>
                  </div>
                  <span className="text-slate-200 font-mono">₹{(seat.price / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Simulator Options */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Payment Gateway Simulation
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Select simulation behavior to test transaction isolation, retry logic, or the fallback rule:
            </p>

            <div className="space-y-3">
              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  simulationMode === 'MOCK_SUCCESS'
                    ? 'bg-indigo-950/40 border-indigo-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="simulation"
                  value="MOCK_SUCCESS"
                  checked={simulationMode === 'MOCK_SUCCESS'}
                  onChange={() => setSimulationMode('MOCK_SUCCESS')}
                  className="mt-1 text-indigo-600 focus:ring-0"
                />
                <div>
                  <div className="font-semibold text-sm text-slate-200">MOCK_SUCCESS (Happy Path)</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Gateway completes successfully. Confirms booking and generates signed tickets.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  simulationMode === 'MOCK_FAIL'
                    ? 'bg-rose-950/30 border-rose-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="simulation"
                  value="MOCK_FAIL"
                  checked={simulationMode === 'MOCK_FAIL'}
                  onChange={() => setSimulationMode('MOCK_FAIL')}
                  className="mt-1 text-rose-500 focus:ring-0"
                />
                <div>
                  <div className="font-semibold text-sm text-slate-200">MOCK_FAIL (Payment Failure)</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Simulates card decline. Booking remains PENDING_PAYMENT allowing a clean retry.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start space-x-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  simulationMode === 'MOCK_TIMEOUT'
                    ? 'bg-amber-950/30 border-amber-500 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="simulation"
                  value="MOCK_TIMEOUT"
                  checked={simulationMode === 'MOCK_TIMEOUT'}
                  onChange={() => setSimulationMode('MOCK_TIMEOUT')}
                  className="mt-1 text-amber-500 focus:ring-0"
                />
                <div>
                  <div className="font-semibold text-sm text-slate-200">MOCK_TIMEOUT (Gateway Timeout)</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Simulates third-party network timeout outside DB transaction boundaries.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Checkout Button */}
        <div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-24">
            <h3 className="text-base font-bold text-white mb-4">Payment Summary</h3>

            <div className="space-y-3 text-sm pb-4 border-b border-slate-800">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono text-slate-200">₹{totalRupees}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Booking Fee</span>
                <span className="font-mono text-emerald-400">₹0.00</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Integrated Tax</span>
                <span className="font-mono text-emerald-400">₹0.00</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline py-4 mb-6">
              <span className="text-base font-bold text-white">Total Amount</span>
              <span className="text-2xl font-extrabold text-indigo-400 font-mono">
                ₹{totalRupees}
              </span>
            </div>

            <button
              onClick={handlePayAndConfirm}
              disabled={processing || !!refundNotice}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition duration-150 flex items-center justify-center space-x-2 text-sm"
            >
              {processing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Pay & Confirm Booking</span>
                </>
              )}
            </button>

            <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Idempotent 256-bit Encrypted Transaction</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
