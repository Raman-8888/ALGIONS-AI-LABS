export type Role = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Genre {
  _id: string;
  name: string;
  slug: string;
}

export interface Movie {
  _id: string;
  title: string;
  synopsis: string;
  durationMinutes: number;
  releaseDate: string;
  genres: Genre[] | string[];
  languages: string[];
  posterUrl?: string;
  trailerUrl?: string;
  isActive: boolean;
}

export interface ScreenLayout {
  rows: number;
  columns: number;
  aisles: number[];
  rowCategoryMap: Record<string, string>;
  gaps?: { row: number; col: number }[];
}

export interface Screen {
  _id: string;
  theatre: string | Theatre;
  name: string;
  layout: ScreenLayout;
  totalSeats: number;
  scheduleVersion: number;
  isActive: boolean;
}

export interface Theatre {
  _id: string;
  name: string;
  city: string;
  address: string;
  timezone: string;
  isActive: boolean;
}

export interface Show {
  _id: string;
  movie: Movie;
  theatre: Theatre;
  screen: Screen;
  startsAt: string;
  endsAt: string;
  cleaningBufferMinutes: number;
  priceByCategory: Record<string, number>;
  status: 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  totalSeats: number;
  availableSeats: number;
}

export interface ShowSeat {
  _id: string;
  show: string;
  seatLabel: string;
  row: string;
  column: number;
  category: string;
  price: number;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED';
  isMine?: boolean;
  expiresInSeconds?: number;
}

export interface SeatMapResponse {
  showId: string;
  movieTitle: string;
  theatreName: string;
  screenName: string;
  startsAt: string;
  endsAt: string;
  priceByCategory: Record<string, number>;
  layout: ScreenLayout;
  seats: ShowSeat[];
  summary: {
    total: number;
    available: number;
    held: number;
    booked: number;
  };
}

export interface Ticket {
  _id: string;
  ticketReference: string;
  seatLabel: string;
  category: string;
  priceSnapshot: number;
  qrPayloadToken: string;
  status: 'VALID' | 'USED' | 'CANCELLED';
  validatedAt?: string;
}

export interface Booking {
  _id: string;
  bookingReference: string;
  user: string | User;
  show: Show;
  seats: Array<{
    seatId: string;
    seatLabel: string;
    category: string;
    pricePaise: number;
  }>;
  totalAmount: number;
  currency: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
  holdExpiresAt?: string;
  tickets?: Ticket[];
  createdAt: string;
  cancellationReason?: string;
  cancelledAt?: string;
}

export interface AuditLog {
  _id: string;
  actorType: 'USER' | 'SYSTEM' | 'ANONYMOUS';
  actorId?: User | string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface OccupancyReport {
  showId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  movieTitle: string;
  screenName: string;
  totalSeats: number;
  confirmedBookingsCount: number;
  bookedSeatsCount: number;
  occupancyPercentage: number;
}

export interface SalesReport {
  grossRevenuePaise: number;
  refundedAmountPaise: number;
  netRevenuePaise: number;
  totalBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  theatreBreakdown: Array<{
    theatreId: string;
    theatreName: string;
    city: string;
    grossPaise: number;
    refundedPaise: number;
    netPaise: number;
    confirmedBookings: number;
  }>;
}

