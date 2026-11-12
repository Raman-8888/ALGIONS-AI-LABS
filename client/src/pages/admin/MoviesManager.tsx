import React, { useState, useEffect } from 'react';
import { Movie, Genre } from '../../types';
import { api, ApiError } from '../../api/client';
import { Modal } from '../../components/Modal';
import { Film, Plus, Trash2, Clock, Calendar, AlertCircle } from 'lucide-react';

export const MoviesManager: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [releaseDate, setReleaseDate] = useState('2026-05-15');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [languages, setLanguages] = useState('English, Hindi');
  const [posterUrl, setPosterUrl] = useState('');
  const [trailerUrl, setTrailerUrl] = useState('');

  const fetchData = async () => {
    try {
      const [movieList, genreList] = await Promise.all([
        api.movies.list(),
        api.genres.list(),
      ]);
      setMovies(movieList);
      setGenres(genreList);
    } catch (err) {
      console.error('Failed to load movies', err);
      setError('Failed to fetch movies catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setActionLoading(true);

    try {
      await api.movies.create({
        title,
        synopsis,
        durationMinutes,
        releaseDate: new Date(releaseDate).toISOString(),
        genres: selectedGenres,
        languages: languages.split(',').map((s) => s.trim()).filter(Boolean),
        posterUrl: posterUrl.trim() || undefined,
        trailerUrl: trailerUrl.trim() || undefined,
      });

      setIsCreateOpen(false);
      resetForm();
      await fetchData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create movie.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMovie = async (movieId: string) => {
    if (!window.confirm('Are you sure you want to delete this movie?')) return;
    setError(null);

    try {
      await api.movies.delete(movieId);
      await fetchData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to delete movie.');
      }
    }
  };

  const resetForm = () => {
    setTitle('');
    setSynopsis('');
    setDurationMinutes(120);
    setReleaseDate('2026-05-15');
    setSelectedGenres([]);
    setLanguages('English, Hindi');
    setPosterUrl('');
    setTrailerUrl('');
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
            Catalog Management
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">Movies Manager</h1>
          <p className="text-sm text-slate-400 mt-1">
            Maintain movie inventory, durations, trailers, and soft-delete guards
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-md transition text-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Movie</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Movies Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Movie</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-4">Release Date</th>
                <th className="py-3.5 px-4">Genres</th>
                <th className="py-3.5 px-4">Languages</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {movies.map((movie) => (
                <tr key={movie._id} className="hover:bg-slate-850/50 transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-14 bg-slate-950 rounded flex-shrink-0 overflow-hidden border border-slate-800">
                        {movie.posterUrl ? (
                          <img
                            src={movie.posterUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Film className="w-4 h-4 text-slate-600 m-auto mt-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{movie.title}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 max-w-xs">
                          {movie.synopsis}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{movie.durationMinutes}m</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(movie.releaseDate).toLocaleDateString()}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {movie.genres.map((g, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]"
                        >
                          {typeof g === 'string' ? g : g.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">{movie.languages.join(', ')}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDeleteMovie(movie._id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      title="Delete Movie"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Movie Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add New Movie">
        <form onSubmit={handleCreateMovie} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Movie Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Interstellar"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Synopsis
            </label>
            <textarea
              required
              rows={3}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Movie summary..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                min={1}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Release Date
              </label>
              <input
                type="date"
                required
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Select Genres
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              {genres.map((g) => {
                const isSelected = selectedGenres.includes(g._id);
                return (
                  <button
                    type="button"
                    key={g._id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedGenres(selectedGenres.filter((id) => id !== g._id));
                      } else {
                        setSelectedGenres([...selectedGenres, g._id]);
                      }
                    }}
                    className={`px-2.5 py-1 rounded text-xs transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Languages (comma separated)
            </label>
            <input
              type="text"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="English, Hindi, Tamil"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Poster URL
              </label>
              <input
                type="url"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Trailer URL
              </label>
              <input
                type="url"
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
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
              {actionLoading ? 'Saving...' : 'Add Movie'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

