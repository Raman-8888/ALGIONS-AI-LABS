import React, { useState, useEffect } from 'react';
import { Booking, Ticket } from '../types';
import { api, ApiError } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { QRCodeSVG } from 'qrcode.react';
import { Ticket as TicketIcon, Calendar, Film, QrCode, AlertCircle, Ban } from 'lucide-react';

export const MyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation');
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = async () => {
    try {
      const data = await api.bookings.getMyBookings();
      setBookings(data);
    } catch (err) {
      console.error('Failed to load bookings', err);
      setError('Failed to fetch your booking history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async () => {
    if (!cancelModalBooking) return;
    setCancelling(true);
    setError(null);

    try {
      await api.bookings.cancel(cancelModalBooking._id, cancelReason);
      setCancelModalBooking(null);
      await fetchBookings();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to cancel booking.');
      }
    } finally {
      setCancelling(false);
    }
  };

  const isCancellationAllowed = (startsAt: string) => {
    const showTime = new Date(startsAt).getTime();
    const now = Date.now();
    const minutesLeft = (showTime - now) / (1000 * 60);
    return minutesLeft > 60;
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">My Bookings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your movie tickets, access digital QR passes, and view refunds
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {bookings.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 rounded-3xl border border-slate-800">
          <TicketIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-300">No bookings yet</h3>
          <p className="text-xs text-slate-500 mt-1">You haven&apos;t reserved any movie tickets yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => {
            const canCancel =
              booking.status === 'CONFIRMED' &&
              booking.show &&
              isCancellationAllowed(booking.show.startsAt);

            return (
              <div
                key={booking._id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md"
              >
                {/* Header row: Reference & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2 mb-4">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-white text-base">
                      #{booking.bookingReference}
                    </span>
                    <StatusBadge status={booking.status} />
                  </div>
                  <div className="text-xs text-slate-400">
                    Booked on {new Date(booking.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Show Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="md:col-span-2 space-y-1">
                    <div className="flex items-center space-x-2 text-white font-bold text-lg">
                      <Film className="w-5 h-5 text-indigo-400" />
                      <span>{booking.show?.movie?.title || 'Movie Title'}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {booking.show?.theatre?.name} • {booking.show?.screen?.name}
                    </div>
                    {booking.show?.startsAt && (
                      <div className="flex items-center space-x-1.5 text-xs text-indigo-400 font-medium pt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {new Date(booking.show.startsAt).toLocaleString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-left md:text-right">
                    <div className="text-xs text-slate-400">Total Paid</div>
                    <div className="text-xl font-extrabold text-white font-mono">
                      ₹{(booking.totalAmount / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {booking.seats.length} {booking.seats.length === 1 ? 'Seat' : 'Seats'} (
                      {booking.seats.map((s) => s.seatLabel).join(', ')})
                    </div>
                  </div>
                </div>

                {/* Tickets & Cancellation Actions */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  {/* Ticket List */}
                  <div className="flex flex-wrap items-center gap-2">
                    {booking.tickets && booking.tickets.length > 0 ? (
                      booking.tickets.map((t) => (
                        <button
                          key={t._id}
                          onClick={() => setSelectedTicket(t)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition"
                        >
                          <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Seat {t.seatLabel || (t as any).showSeat?.seatLabel || 'Pass'} (QR)</span>
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">
                        {booking.status === 'CANCELLED'
                          ? 'Tickets invalidated (Refunded)'
                          : 'No active tickets'}
                      </span>
                    )}
                  </div>

                  {/* Cancel Button */}
                  {booking.status === 'CONFIRMED' && (
                    <div>
                      {canCancel ? (
                        <button
                          onClick={() => setCancelModalBooking(booking)}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 transition"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Cancel Booking</span>
                        </button>
                      ) : (
                        <span
                          title="Cancellation is only permitted more than 60 minutes before showtime"
                          className="text-[11px] text-slate-500 italic bg-slate-950 px-2.5 py-1 rounded border border-slate-800"
                        >
                          Cancellation Closed (&lt; 60m)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ticket QR Modal */}
      <Modal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={`Digital Admission Pass - Seat ${selectedTicket?.seatLabel}`}
      >
        {selectedTicket && (
          <div className="text-center py-2">
            <div className="inline-block bg-white p-4 rounded-2xl shadow-xl mb-4">
              <QRCodeSVG value={selectedTicket.qrPayloadToken} size={180} level="H" />
            </div>
            <div className="text-xs font-mono text-slate-400">
              Pass Token: {selectedTicket.ticketReference}
            </div>
            <div className="mt-3 flex items-center justify-center space-x-2">
              <StatusBadge status={selectedTicket.status} />
              <span className="text-xs text-slate-300 font-semibold">{selectedTicket.category}</span>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              Present this QR code to auditorium staff for admission scanning.
            </p>
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={!!cancelModalBooking}
        onClose={() => setCancelModalBooking(null)}
        title="Confirm Booking Cancellation"
      >
        {cancelModalBooking && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
              <strong>Cancellation Policy:</strong> A 100% refund of{' '}
              <strong>₹{(cancelModalBooking.totalAmount / 100).toFixed(2)}</strong> will be processed to
              your payment method. All associated seat holds and QR admission tickets will be cancelled.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Reason for Cancellation
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setCancelModalBooking(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={cancelling}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

