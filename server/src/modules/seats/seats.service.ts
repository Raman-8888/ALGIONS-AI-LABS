import { Show } from '../../db/models/Show.js';
import { ShowSeat } from '../../db/models/ShowSeat.js';
import { Screen } from '../../db/models/Screen.js';
import { AppError } from '../../common/errors/AppError.js';

export interface SeatMapResponse {
  show: {
    id: string;
    movie: any;
    screen: {
      id: string;
      name: string;
      totalSeats: number;
      seatLayout: any;
    };
    startsAt: Date;
    endsAt: Date;
    language: string;
    format: string;
    priceByCategory: Record<string, number>;
    currency: string;
  };
  summary: {
    totalSeats: number;
    availableSeats: number;
    heldSeats: number;
    bookedSeats: number;
    priceRange: {
      min: number;
      max: number;
    };
  };
  seats: Array<{
    id: string;
    seatLabel: string;
    row: string;
    number: number;
    category: string;
    priceInPaise: number;
    currency: string;
    status: 'AVAILABLE' | 'HELD' | 'BOOKED';
    isMine: boolean;
    holdSecondsRemaining?: number;
  }>;
}

export class SeatsService {
  static async getShowSeatMap(showId: string, currentUserId?: string): Promise<SeatMapResponse> {
    const show = await Show.findById(showId)
      .populate('movie', 'title durationMinutes posterUrl languages genres')
      .populate({
        path: 'screen',
        populate: { path: 'theatre', select: 'name city timezone' },
      })
      .lean();

    if (!show) {
      throw AppError.notFound(`Show with id ${showId} not found`);
    }

    if (show.status === 'CANCELLED') {
      throw AppError.badRequest('This show has been cancelled and cannot accept seat selection');
    }

    const screen = show.screen as any;
    const now = new Date();

    // Query seats with lean projection and index { show: 1, status: 1, holdExpiresAt: 1 }
    const rawSeats = await ShowSeat.find(
      { show: show._id },
      '_id seatLabel row number category priceInPaise currency status heldBy holdExpiresAt',
    )
      .sort({ row: 1, number: 1 })
      .lean();

    let availableCount = 0;
    let heldCount = 0;
    let bookedCount = 0;
    let minPrice = Infinity;
    let maxPrice = 0;

    const projectedSeats = rawSeats.map((s) => {
      let status: 'AVAILABLE' | 'HELD' | 'BOOKED' = 'AVAILABLE';
      let isMine = false;
      let holdSecondsRemaining: number | undefined;

      if (s.priceInPaise < minPrice) minPrice = s.priceInPaise;
      if (s.priceInPaise > maxPrice) maxPrice = s.priceInPaise;

      if (s.status === 'BOOKED') {
        status = 'BOOKED';
        bookedCount++;
      } else if (s.status === 'HELD') {
        // Dual Expiry Strategy: Lazy evaluation of expired holds
        if (s.holdExpiresAt && s.holdExpiresAt < now) {
          status = 'AVAILABLE';
          availableCount++;
        } else {
          status = 'HELD';
          heldCount++;
          if (currentUserId && s.heldBy && s.heldBy.toString() === currentUserId) {
            isMine = true;
            if (s.holdExpiresAt) {
              holdSecondsRemaining = Math.max(
                0,
                Math.floor((new Date(s.holdExpiresAt).getTime() - now.getTime()) / 1000),
              );
            }
          }
        }
      } else {
        status = 'AVAILABLE';
        availableCount++;
      }

      return {
        id: s._id.toString(),
        seatLabel: s.seatLabel,
        row: s.row,
        number: s.number,
        category: s.category,
        priceInPaise: s.priceInPaise,
        currency: s.currency,
        status,
        isMine,
        ...(holdSecondsRemaining !== undefined ? { holdSecondsRemaining } : {}),
      };
    });

    return {
      show: {
        id: show._id.toString(),
        movie: show.movie,
        screen: {
          id: screen._id.toString(),
          name: screen.name,
          totalSeats: (screen.seatLayout?.rows * screen.seatLayout?.columns) - (screen.seatLayout?.gapSeats?.length || 0),
          seatLayout: screen.seatLayout,
        },
        startsAt: show.startsAt,
        endsAt: show.endsAt,
        language: show.language,
        format: show.format,
        priceByCategory: show.priceByCategory as any,
        currency: show.currency,
      },
      summary: {
        totalSeats: projectedSeats.length,
        availableSeats: availableCount,
        heldSeats: heldCount,
        bookedSeats: bookedCount,
        priceRange: {
          min: minPrice === Infinity ? 0 : minPrice,
          max: maxPrice,
        },
      },
      seats: projectedSeats,
    };
  }
}

