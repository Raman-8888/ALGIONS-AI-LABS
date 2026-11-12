import React from 'react';
import { useLocation, Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Ticket, Film, Calendar, MapPin, ArrowRight } from 'lucide-react';

export const Confirmation: React.FC = () => {
  const { id: bookingId } = useParams<{ id: string }>();
  const location = useLocation();

  const state = location.state as {
    booking?: {
      _id: string;
      bookingReference: string;
      totalAmount: number;
    };
    tickets?: Array<{
      ticketReference: string;
      seatLabel: string;
      category: string;
      priceSnapshot: number;
      qrPayloadToken: string;
    }>;
    movieTitle?: string;
    theatreName?: string;
    screenName?: string;
    startsAt?: string;
  } | null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Success Badge */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 bg-emerald-500/10 text-emerald-400 rounded-full mb-3 border border-emerald-500/20">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Booking Confirmed!</h1>
        <p className="text-sm text-slate-400 mt-1">
          Your reservation is locked in. Show the digital tickets below at the entrance.
        </p>
        {state?.booking?.bookingReference && (
          <div className="mt-4 inline-block px-4 py-1.5 bg-slate-800 text-indigo-300 font-mono font-bold rounded-full text-sm border border-slate-700">
            Reference: {state.booking.bookingReference}
          </div>
        )}
      </div>

      {/* Show Info Card */}
      {state?.movieTitle && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-md">
          <div className="flex items-center space-x-2 text-indigo-400 font-semibold text-xs uppercase tracking-wider mb-2">
            <Film className="w-4 h-4" />
            <span>Show Details</span>
          </div>
          <h2 className="text-xl font-bold text-white">{state.movieTitle}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs text-slate-400 border-t border-slate-800 pt-4">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-slate-500" />
              <span>
                {state.theatreName} • {state.screenName}
              </span>
            </div>
            {state.startsAt && (
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>
                  {new Date(state.startsAt).toLocaleString([], {
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
        </div>
      )}

      {/* Tickets List with QR Codes */}
      <div className="space-y-6 mb-8">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
          <Ticket className="w-4 h-4 text-emerald-400" />
          <span>Digital Admission Tickets</span>
        </h3>

        {state?.tickets && state.tickets.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {state.tickets.map((ticket, idx) => (
              <div
                key={ticket.ticketReference || ticket.reference || ticket.id || idx}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex items-center space-x-4"
              >
                {/* QR Code Container */}
                <div className="bg-white p-2 rounded-xl flex-shrink-0 shadow-inner">
                  <QRCodeSVG value={ticket.qrPayloadToken || ticket.qrToken || ticket.reference || 'VALID'} size={90} level="M" />
                </div>

                {/* Ticket Details */}
                <div className="flex-grow">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Ticket Pass
                  </div>
                  <div className="text-lg font-extrabold text-white">Seat {ticket.seatLabel || `Pass #${idx + 1}`}</div>
                  <div className="text-xs text-indigo-400 font-medium">{ticket.category || 'Standard'}</div>
                  <div className="text-[11px] font-mono text-slate-400 mt-2 truncate">
                    {ticket.ticketReference || ticket.reference || ticket.id}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-900 rounded-2xl border border-slate-800 text-xs text-slate-400">
            Tickets are registered under reference #{bookingId}. Access them in your booking history.
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          to="/my-bookings"
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-2.5 rounded-xl shadow-md transition text-sm"
        >
          <span>View My Bookings</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/"
          className="w-full sm:w-auto inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-6 py-2.5 rounded-xl border border-slate-700 transition text-sm"
        >
          Browse More Movies
        </Link>
      </div>
    </div>
  );
};

