import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export interface IShowSeat extends Document {
  show: Types.ObjectId;
  seatLabel: string;
  row: string;
  number: number;
  category: string;
  priceInPaise: number;
  currency: string;
  status: SeatStatus;
  heldBy: Types.ObjectId | null;
  holdExpiresAt: Date | null;
  booking: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const showSeatSchema = new Schema<IShowSeat>(
  {
    show: {
      type: Schema.Types.ObjectId,
      ref: 'Show',
      required: true,
      index: true,
    },
    seatLabel: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    row: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    number: {
      type: Number,
      required: true,
      min: 1,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    priceInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      required: true,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'HELD', 'BOOKED'],
      default: 'AVAILABLE',
      required: true,
    },
    heldBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    holdExpiresAt: {
      type: Date,
      default: null,
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

showSeatSchema.index({ show: 1, seatLabel: 1 }, { unique: true });
showSeatSchema.index({ show: 1, status: 1, holdExpiresAt: 1 });
showSeatSchema.index({ heldBy: 1, show: 1, status: 1 });

export const ShowSeat: Model<IShowSeat> =
  mongoose.models.ShowSeat || mongoose.model<IShowSeat>('ShowSeat', showSeatSchema);

