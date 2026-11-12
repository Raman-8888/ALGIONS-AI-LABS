import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Movie, Show, Theatre } from '../types';
import { api } from '../api/client';
import { Clock, Calendar, Globe, MapPin, Film, PlayCircle, AlertCircle } from 'lucide-react';

interface GroupedShows {
  theatre: Theatre;
  shows: Show[];
}

export const MovieDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [theatreShows, setTheatreShows] = useState<GroupedShows[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      try {
        const [movieData, showsData] = await Promise.all([
          api.movies.get(id),
          api.shows.getByMovie(id),
        ]);
        setMovie(movieData);
        setTheatreShows(showsData);
      } catch (err: unknown) {
        console.error('Failed to load movie details', err);
        setError('Failed to load movie details or upcoming showtimes.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Movie Not Found</h2>
        <p className="text-slate-400 mt-1">{error || 'Could not locate the requested movie.'}</p>
        <Link to="/" className="mt-4 inline-block px-4 py-2 bg-slate-800 text-slate-200 rounded-lg text-sm font-medium hover:bg-slate-700">
          Back to Browse
        </Link>
      </div>
    );
  }

  const formatShowTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatShowDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getLowestPrice = (priceMap: Record<string, number>) => {
    const prices = Object.values(priceMap);
    if (!prices.length) return null;
    const minPaise = Math.min(...prices);
    return (minPaise / 100).toFixed(0);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Movie Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 sm:p-8 mb-10 flex flex-col md:flex-row gap-8">
        {/* Poster */}
        <div className="w-full md:w-64 aspect-[2/3] bg-slate-950 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg border border-slate-800">
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
              <Film className="w-12 h-12 mb-2" />
              <span className="text-xs">No Poster</span>
            </div>
          )}
        </div>

        {/* Details Content */}
        <div className="flex flex-col justify-between flex-grow">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {movie.genres.map((g, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                >
                  {typeof g === 'string' ? g : g.name}
                </span>
              ))}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {movie.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 mt-3">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>{movie.durationMinutes} mins</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>{new Date(movie.releaseDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Globe className="w-4 h-4 text-slate-500" />
                <span>{movie.languages.join(', ')}</span>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Synopsis</h3>
              <p className="text-slate-300 leading-relaxed text-sm sm:text-base">
                {movie.synopsis || 'No synopsis provided.'}
              </p>
            </div>
          </div>

          {movie.trailerUrl && (
            <div className="mt-6 pt-4 border-t border-slate-800">
              <a
                href={movie.trailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-indigo-400 hover:text-indigo-300 font-semibold text-sm transition"
              >
                <PlayCircle className="w-5 h-5" />
                <span>Watch Official Trailer</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Showtimes Section */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight mb-6 flex items-center space-x-2">
          <span>Available Theatres & Showtimes</span>
        </h2>

        {theatreShows.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 rounded-2xl border border-slate-800">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-300 font-medium">No scheduled shows currently available</p>
            <p className="text-slate-500 text-xs mt-1">Check back later or check another movie.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {theatreShows.map(({ theatre, shows }) => (
              <div
                key={theatre._id || (theatre as any).id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md"
              >
                {/* Theatre Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{theatre.name}</h3>
                    <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span>{theatre.address}, {theatre.city}</span>
                    </div>
                  </div>
                  <span className="text-xs text-indigo-400 font-medium bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 self-start sm:self-auto">
                    {theatre.timezone}
                  </span>
                </div>

                {/* Show Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {shows.map((show) => {
                    const lowest = getLowestPrice(show.priceByCategory);
                    const showId = show._id || (show as any).id;
                    const screenName = show.screen?.name || (show as any).screenName || 'Auditorium';
                    return (
                      <Link
                        key={showId}
                        to={`/shows/${showId}/seats`}
                        className="group bg-slate-950 border border-slate-800 hover:border-indigo-500 rounded-xl p-4 transition duration-150 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span>{screenName}</span>
                            <span className="text-slate-500">{formatShowDate(show.startsAt)}</span>
                          </div>

                          <div className="text-xl font-bold text-white group-hover:text-indigo-400 transition">
                            {formatShowTime(show.startsAt)}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between text-xs">
                          {lowest && (
                            <span className="text-slate-400">
                              From <strong className="text-emerald-400 font-semibold">₹{lowest}</strong>
                            </span>
                          )}
                          <span className="text-indigo-400 font-medium group-hover:translate-x-0.5 transition">
                            Select Seats →
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

