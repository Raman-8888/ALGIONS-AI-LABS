import React, { useState, useEffect } from 'react';
import { Theatre, Screen } from '../../types';
import { api, ApiError } from '../../api/client';
import { Modal } from '../../components/Modal';
import { Building2, Plus, Monitor, MapPin, AlertCircle, Grid } from 'lucide-react';

export const TheatresManager: React.FC = () => {
  const [theatres, setTheatres] = useState<Theatre[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [selectedTheatreId, setSelectedTheatreId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isAddTheatreOpen, setIsAddTheatreOpen] = useState(false);
  const [isAddScreenOpen, setIsAddScreenOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Add Theatre Form
  const [theatreName, setTheatreName] = useState('');
  const [city, setCity] = useState('Mumbai');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  // Add Screen Form
  const [screenName, setScreenName] = useState('Screen 1');
  const [rows, setRows] = useState(5);
  const [columns, setColumns] = useState(8);
  const [aislesInput, setAislesInput] = useState('4');

  const fetchData = async () => {
    try {
      const theatreList = await api.theatres.list();
      setTheatres(theatreList);
      if (theatreList.length > 0) {
        const defaultId = selectedTheatreId || theatreList[0]._id;
        setSelectedTheatreId(defaultId);
        const screenList = await api.screens.list(defaultId);
        setScreens(screenList);
      }
    } catch (err) {
      console.error('Failed to load theatres', err);
      setError('Failed to fetch theatres.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectTheatre = async (id: string) => {
    setSelectedTheatreId(id);
    try {
      const screenList = await api.screens.list(id);
      setScreens(screenList);
    } catch (err) {
      console.error('Failed to load screens', err);
    }
  };

  const handleCreateTheatre = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionLoading(true);

    try {
      await api.theatres.create({
        name: theatreName,
        city,
        address,
        timezone,
      });

      setIsAddTheatreOpen(false);
      setTheatreName('');
      setAddress('');
      await fetchData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create theatre.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionLoading(true);

    // Build row category map:
    // Row 0..1 => VIP, Row 2..3 => PREMIUM, Row 4+ => STANDARD
    const rowCategoryMap: Record<string, string> = {};
    for (let r = 0; r < rows; r++) {
      const rowLetter = String.fromCharCode(65 + r);
      if (r < 1) rowCategoryMap[rowLetter] = 'VIP';
      else if (r < 3) rowCategoryMap[rowLetter] = 'PREMIUM';
      else rowCategoryMap[rowLetter] = 'STANDARD';
    }

    const aisles = aislesInput
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);

    try {
      await api.screens.create({
        theatre: selectedTheatreId,
        name: screenName,
        layout: {
          rows,
          columns,
          aisles,
          rowCategoryMap,
        },
      });

      setIsAddScreenOpen(false);
      setScreenName(`Screen ${screens.length + 1}`);
      await handleSelectTheatre(selectedTheatreId);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create screen.');
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

  const activeTheatre = theatres.find((t) => t._id === selectedTheatreId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4 mb-8">
        <div>
          <span className="px-3 py-1 bg-indigo-500/15 text-indigo-300 text-xs font-semibold rounded-full uppercase tracking-wider border border-indigo-500/30">
            Locations & Screen Geometry
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">
            Theatres & Screens Manager
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure multiplex complexes, screens, aisles, and category layouts
          </p>
        </div>

        <div className="flex items-center space-x-3 self-start sm:self-auto">
          <button
            onClick={() => setIsAddTheatreOpen(true)}
            className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-3.5 py-2 rounded-xl border border-slate-700 text-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Theatre</span>
          </button>
          <button
            onClick={() => setIsAddScreenOpen(true)}
            disabled={!selectedTheatreId}
            className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Screen</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Theatres Sidebar & Screens Detail */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Theatres Sidebar */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Cinemas ({theatres.length})
          </h3>
          <div className="space-y-3">
            {theatres.map((t) => (
              <button
                key={t._id}
                onClick={() => handleSelectTheatre(t._id)}
                className={`w-full text-left p-4 rounded-2xl border transition ${
                  selectedTheatreId === t._id
                    ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold text-sm">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span>{t.name}</span>
                </div>
                <div className="flex items-center space-x-1 text-xs text-slate-400 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {t.city} • {t.timezone}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Screens Grid */}
        <div className="md:col-span-2">
          {activeTheatre && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md mb-6">
              <h3 className="text-lg font-bold text-white">{activeTheatre.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeTheatre.address}, {activeTheatre.city} ({activeTheatre.timezone})
              </p>
            </div>
          )}

          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Auditorium Screens ({screens.length})
          </h3>

          {screens.length === 0 ? (
            <div className="text-center py-12 bg-slate-900 rounded-2xl border border-slate-800 text-xs text-slate-500">
              No screens configured yet for this theatre. Click &quot;Add Screen&quot; above.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {screens.map((screen) => (
                <div
                  key={screen._id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2 font-bold text-white text-base">
                        <Monitor className="w-4 h-4 text-emerald-400" />
                        <span>{screen.name}</span>
                      </div>
                      <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                        v{screen.scheduleVersion} lock
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-400">
                      <div>
                        Total Capacity: <strong className="text-white">{screen.totalSeats} seats</strong>
                      </div>
                      <div>
                        Grid Geometry: {screen.layout?.rows} Rows × {screen.layout?.columns} Columns
                      </div>
                      {screen.layout?.aisles && screen.layout.aisles.length > 0 && (
                        <div>Aisles at Column: {screen.layout.aisles.join(', ')}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center space-x-1">
                      <Grid className="w-3.5 h-3.5" />
                      <span>Screen ID: {screen._id.slice(-6)}</span>
                    </span>
                    <span className="text-emerald-400 font-semibold">Active</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Theatre Modal */}
      <Modal isOpen={isAddTheatreOpen} onClose={() => setIsAddTheatreOpen(false)} title="Add Cinema Theatre">
        <form onSubmit={handleCreateTheatre} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Theatre Name
            </label>
            <input
              type="text"
              required
              value={theatreName}
              onChange={(e) => setTheatreName(e.target.value)}
              placeholder="e.g. Cinepolis IMAX"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                City
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Timezone
              </label>
              <input
                type="text"
                required
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Full Address
            </label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Phoenix Palladium Mall, Lower Parel"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddTheatreOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
            >
              {actionLoading ? 'Saving...' : 'Add Theatre'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Screen Modal */}
      <Modal isOpen={isAddScreenOpen} onClose={() => setIsAddScreenOpen(false)} title="Configure Screen Layout">
        <form onSubmit={handleCreateScreen} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Screen Name
            </label>
            <input
              type="text"
              required
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              placeholder="e.g. Screen 1 - Dolby Atmos"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Number of Rows
              </label>
              <input
                type="number"
                min={1}
                max={26}
                required
                value={rows}
                onChange={(e) => setRows(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Seats Per Row (Columns)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                required
                value={columns}
                onChange={(e) => setColumns(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Aisle Column Numbers (comma separated)
            </label>
            <input
              type="text"
              value={aislesInput}
              onChange={(e) => setAislesInput(e.target.value)}
              placeholder="e.g. 4, 8"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            />
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400">
            <div>Calculated Total Capacity: <strong className="text-white">{rows * columns} Seats</strong></div>
            <div className="text-[11px] text-slate-500 mt-1">
              Row A: VIP | Rows B-C: PREMIUM | Rows D+: STANDARD
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddScreenOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
            >
              {actionLoading ? 'Creating Screen...' : 'Create Screen Layout'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

