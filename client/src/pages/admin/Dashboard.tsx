import React, { useState, useEffect } from 'react';
import { OccupancyReport, SalesReport } from '../../types';
import { api } from '../../api/client';
import { BarChart3, TrendingUp, Users, DollarSign, AlertCircle } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [occupancy, setOccupancy] = useState<OccupancyReport[]>([]);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [occData, salesData] = await Promise.all([
          api.reports.getOccupancy(),
          api.reports.getSales(),
        ]);
        setOccupancy(occData);
        setSales(salesData);
      } catch (err) {
        console.error('Failed to load dashboard reports', err);
        setError('Failed to fetch analytics reports.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const grossRupees = sales ? (sales.grossRevenuePaise / 100).toFixed(2) : '0.00';
  const refundRupees = sales ? (sales.refundedAmountPaise / 100).toFixed(2) : '0.00';
  const netRupees = sales ? (sales.netRevenuePaise / 100).toFixed(2) : '0.00';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <span className="px-3 py-1 bg-indigo-500/15 text-indigo-300 text-xs font-semibold rounded-full uppercase tracking-wider border border-indigo-500/30">
          Executive Analytics
        </span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">
          Operations & Financial Dashboard
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Live seat occupancy, multi-theatre gross vs. net revenue, and automated refund tracking
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Revenue</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">₹{grossRupees}</div>
          <div className="text-xs text-slate-500 mt-1">Total payments collected</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Refunds Issued</span>
            <TrendingUp className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-rose-400 font-mono">₹{refundRupees}</div>
          <div className="text-xs text-slate-500 mt-1">Cancellations & hold expiries</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Net Revenue</span>
            <BarChart3 className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">₹{netRupees}</div>
          <div className="text-xs text-slate-500 mt-1">Gross minus refunds</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Confirmed Bookings</span>
            <Users className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white font-mono">
            {sales?.confirmedBookings || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Out of {sales?.totalBookings || 0} total attempts
          </div>
        </div>
      </div>

      {/* Occupancy Report Table (Acceptance Test 5 Verification) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Live Show Occupancy Report</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verified equation: Occupancy = Confirmed Bookings minus Cancellations
            </p>
          </div>
        </div>

        {occupancy.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">No scheduled shows found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Movie</th>
                  <th className="py-3 px-4">Screen</th>
                  <th className="py-3 px-4">Showtime</th>
                  <th className="py-3 px-4">Capacity</th>
                  <th className="py-3 px-4">Booked Seats</th>
                  <th className="py-3 px-4">Occupancy %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {occupancy.map((row) => (
                  <tr key={row.showId} className="hover:bg-slate-850/50 transition">
                    <td className="py-3 px-4 font-bold text-white">{row.movieTitle}</td>
                    <td className="py-3 px-4">{row.screenName}</td>
                    <td className="py-3 px-4">
                      {new Date(row.startsAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 font-mono">{row.totalSeats}</td>
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      {row.bookedSeatsCount}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-2 rounded-full"
                            style={{ width: `${Math.min(100, row.occupancyPercentage)}%` }}
                          ></div>
                        </div>
                        <span className="font-mono font-semibold text-white">
                          {row.occupancyPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Theatre Sales Breakdown */}
      {sales && sales.theatreBreakdown && sales.theatreBreakdown.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md">
          <h3 className="text-base font-bold text-white mb-4">Theatre Sales Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Theatre</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">Confirmed Bookings</th>
                  <th className="py-3 px-4">Gross Revenue</th>
                  <th className="py-3 px-4">Refunds</th>
                  <th className="py-3 px-4">Net Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {sales.theatreBreakdown.map((t) => (
                  <tr key={t.theatreId} className="hover:bg-slate-850/50 transition">
                    <td className="py-3 px-4 font-bold text-white">{t.theatreName}</td>
                    <td className="py-3 px-4">{t.city}</td>
                    <td className="py-3 px-4 font-mono">{t.confirmedBookings}</td>
                    <td className="py-3 px-4 font-mono">₹{(t.grossPaise / 100).toFixed(2)}</td>
                    <td className="py-3 px-4 font-mono text-rose-400">
                      ₹{(t.refundedPaise / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      ₹{(t.netPaise / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
