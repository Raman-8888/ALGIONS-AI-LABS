import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Movie, Genre } from '../types';
import { api } from '../api/client';
import { Search, Film, Clock, Calendar } from 'lucide-react';

export const Browse: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [movieList, genreList] = await Promise.all([
          api.movies.list(),
          api.genres.list(),
        ]);
        setMovies(movieList);
        setGenres(genreList);
      } catch (err) {
        console.error('Failed to load browse data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredMovies = (movies || []).filter((m) => {
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase());
    const matchesGenre = !selectedGenre || m.genres.some((g) => {
      const gName = typeof g === 'string' ? g : g.name;
      return gName.toLowerCase() === selectedGenre.toLowerCase();
    });
    return matchesSearch && matchesGenre;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/20 p-8 sm:p-12 mb-10 shadow-2xl">
        <div className="max-w-2xl">
          <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-semibold rounded-full uppercase tracking-wider mb-3 border border-indigo-500/30">
            Real-Time Cinema Experience
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Book Your Seats in <span className="text-indigo-400">Seconds</span>.
          </h1>
          <p className="mt-3 text-slate-300 text-base sm:text-lg">
            Guaranteed atomic seat holds, zero double-bookings, instant HMAC-signed digital tickets.
          </p>
        </div>
      </div>

      {/* Search & Genre Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search movies by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
          />
        </div>

        {/* Genre Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedGenre('')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              selectedGenre === ''
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            All Genres
          </button>
          {genres.map((g) => (
            <button
              key={g._id}
              onClick={() => setSelectedGenre(g.name)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedGenre === g.name
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Movies Grid */}
      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredMovies.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-slate-800">
          <Film className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-300">No movies found</h3>
          <p className="text-sm text-slate-500 mt-1">Try adjusting your search or genre filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredMovies.map((movie) => (
            <Link
              key={movie._id}
              to={`/movie/${movie._id}`}
              className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition duration-200 flex flex-col"
            >
              {/* Poster Container */}
              <div className="aspect-[2/3] w-full bg-slate-950 relative overflow-hidden">
                {movie.posterUrl ? (
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 p-4 text-center">
                    <Film className="w-12 h-12 mb-2" />
                    <span className="text-xs font-medium">No Poster Available</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-semibold text-slate-300 border border-white/10">
                  {movie.languages.join(', ')}
                </div>
              </div>

              {/* Movie Info */}
              <div className="p-4 flex flex-col flex-grow">
                <h3 className="font-bold text-white text-base group-hover:text-indigo-400 transition line-clamp-1">
                  {movie.title}
                </h3>

                <div className="flex items-center space-x-3 text-xs text-slate-400 mt-2">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{movie.durationMinutes}m</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(movie.releaseDate).getFullYear()}</span>
                  </span>
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {movie.genres.slice(0, 2).map((g, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-medium rounded-md border border-slate-700"
                    >
                      {typeof g === 'string' ? g : g.name}
                    </span>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-indigo-400 font-semibold group-hover:translate-x-1 transition duration-150">
                    View Showtimes →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

