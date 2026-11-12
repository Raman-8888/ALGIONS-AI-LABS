import {
  User,
  Movie,
  Genre,
  Theatre,
  Screen,
  Show,
  SeatMapResponse,
  Booking,
  OccupancyReport,
  SalesReport,
  AuditLog,
} from '../types';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  requestId?: string;

  constructor(message: string, status: number, code = 'API_ERROR', details?: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

async function request<T>(
  url: string,
  options: RequestInit = {},
  headers: Record<string, string> = {}
): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const response = await fetch(url, {
    ...options,
    headers: defaultHeaders,
    credentials: 'include',
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorData = body?.error;
    throw new ApiError(
      errorData?.message || `Request failed with status ${response.status}`,
      response.status,
      errorData?.code || 'UNKNOWN_ERROR',
      errorData?.details,
      errorData?.requestId
    );
  }

  return (body?.data !== undefined ? body.data : body) as T;
}

export const api = {
  // Auth
  auth: {
    register: (data: { email: string; name: string; password: string }) =>
      request<{ user: User }>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      request<{ user: User }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    logout: () =>
      request<{ message: string }>('/api/v1/auth/logout', {
        method: 'POST',
      }),
    me: () => request<{ user: User }>('/api/v1/auth/me'),
  },

  // Movies & Genres
  movies: {
    list: (params?: { search?: string; genre?: string }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.append('search', params.search);
      if (params?.genre) qs.append('genre', params.genre);
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request<Movie[]>(`/api/v1/movies${query}`);
    },
    get: (id: string) => request<Movie>(`/api/v1/movies/${id}`),
    create: (data: Partial<Movie>) =>
      request<Movie>('/api/v1/movies', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Movie>) =>
      request<Movie>(`/api/v1/movies/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/api/v1/movies/${id}`, {
        method: 'DELETE',
      }),
  },

  genres: {
    list: () => request<Genre[]>('/api/v1/genres'),
    create: (data: { name: string; slug?: string }) =>
      request<Genre>('/api/v1/genres', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Theatres & Screens
  theatres: {
    list: () => request<Theatre[]>('/api/v1/theatres'),
    create: (data: Partial<Theatre>) =>
      request<Theatre>('/api/v1/theatres', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  screens: {
    list: (theatreId?: string) => {
      const q = theatreId ? `?theatreId=${theatreId}` : '';
      return request<Screen[]>(`/api/v1/screens${q}`);
    },
    create: (data: {
      theatre: string;
      name: string;
      layout: {
        rows: number;
        columns: number;
        aisles: number[];
        rowCategoryMap: Record<string, string>;
      };
    }) =>
      request<Screen>('/api/v1/screens', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Shows
  shows: {
    list: (params?: { theatreId?: string; movieId?: string; from?: string; to?: string }) => {
      const qs = new URLSearchParams();
      if (params?.theatreId) qs.append('theatreId', params.theatreId);
      if (params?.movieId) qs.append('movieId', params.movieId);
      if (params?.from) qs.append('from', params.from);
      if (params?.to) qs.append('to', params.to);
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request<Show[]>(`/api/v1/shows${query}`);
    },
    getByMovie: (movieId: string) =>
      request<Array<{ theatre: Theatre; shows: Show[] }>>(`/api/v1/shows/movie/${movieId}`),
    create: (data: {
      movieId: string;
      theatreId: string;
      screenId: string;
      startsAt: string;
      priceByCategory: Record<string, number>;
      cleaningBufferMinutes?: number;
    }) =>
      request<Show>('/api/v1/shows', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    cancel: (id: string, reason?: string) =>
      request<Show>(`/api/v1/shows/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      }),
  },

  // Seats & Holds
  seats: {
    getSeatMap: (showId: string) => request<SeatMapResponse>(`/api/v1/seats/show/${showId}`),
  },

  holds: {
    acquire: (data: { showId: string; seatIds: string[] }, idempotencyKey = crypto.randomUUID()) =>
      request<{ heldSeats: string[]; holdExpiresAt: string; message: string }>('/api/v1/holds', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }),
    release: (data: { showId: string; seatIds: string[] }) =>
      request<{ releasedSeats: string[]; message: string }>('/api/v1/holds', {
        method: 'DELETE',
        body: JSON.stringify(data),
      }),
  },

  // Bookings & Payments
  bookings: {
    initiate: (data: { showId: string; seatIds: string[] }, idempotencyKey = crypto.randomUUID()) =>
      request<{
        booking: Booking;
        paymentToken: string;
        amount: number;
        currency: string;
      }>('/api/v1/bookings/initiate', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }),

    simulatePayment: (data: {
      bookingId: string;
      simulationMode: 'MOCK_SUCCESS' | 'MOCK_FAIL' | 'MOCK_TIMEOUT';
    }) =>
      request<{
        paymentId: string;
        status: 'SUCCESS' | 'FAILED';
        gatewayTransactionId: string;
        message: string;
      }>('/api/v1/payments/simulate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    confirm: (bookingId: string, paymentId: string, idempotencyKey = crypto.randomUUID()) =>
      request<{
        booking: Booking;
        tickets: Array<{
          ticketReference: string;
          seatLabel: string;
          category: string;
          priceSnapshot: number;
          qrPayloadToken: string;
        }>;
      }>(`/api/v1/bookings/${bookingId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ paymentId }),
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }),

    cancel: (bookingId: string, reason?: string) =>
      request<{
        booking: Booking;
        refundAmountPaise: number;
        message: string;
      }>(`/api/v1/bookings/${bookingId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    getMyBookings: () => request<Booking[]>('/api/v1/bookings/my-bookings'),
  },

  // Tickets
  tickets: {
    validate: (data: { qrToken?: string; ticketReference?: string; showId: string }) =>
      request<{
        ticket: {
          ticketReference: string;
          seatLabel: string;
          category: string;
          status: string;
          validatedAt: string;
        };
        message: string;
      }>('/api/v1/tickets/validate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Reports
  reports: {
    getOccupancy: (params?: { showId?: string; theatreId?: string; from?: string; to?: string }) => {
      const qs = new URLSearchParams();
      if (params?.showId) qs.append('showId', params.showId);
      if (params?.theatreId) qs.append('theatreId', params.theatreId);
      if (params?.from) qs.append('from', params.from);
      if (params?.to) qs.append('to', params.to);
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request<OccupancyReport[]>(`/api/v1/reports/occupancy${query}`);
    },
    getSales: (params?: { from?: string; to?: string; theatreId?: string }) => {
      const qs = new URLSearchParams();
      if (params?.from) qs.append('from', params.from);
      if (params?.to) qs.append('to', params.to);
      if (params?.theatreId) qs.append('theatreId', params.theatreId);
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request<SalesReport>(`/api/v1/reports/sales${query}`);
    },
  },

  // Audit
  audit: {
    list: (params?: {
      action?: string;
      actorId?: string;
      targetType?: string;
      from?: string;
      to?: string;
      limit?: number;
      skip?: number;
    }) => {
      const qs = new URLSearchParams();
      if (params?.action) qs.append('action', params.action);
      if (params?.actorId) qs.append('actorId', params.actorId);
      if (params?.targetType) qs.append('targetType', params.targetType);
      if (params?.from) qs.append('from', params.from);
      if (params?.to) qs.append('to', params.to);
      if (params?.limit) qs.append('limit', String(params.limit));
      if (params?.skip) qs.append('skip', String(params.skip));
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request<{
        logs: AuditLog[];
        pagination: { total: number; limit: number; skip: number };
      }>(`/api/v1/audit${query}`);
    },
  },
};

