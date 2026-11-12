import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

export interface ISeatSnapshot {
  seatId: Types.ObjectId;
  seatLabel: string;
  category: string;
  priceInPaise: number;
}

export interface IBooking extends Document {
  reference: string;
  user: Types.ObjectId;
  show: Types.ObjectId;
  seats: Types.ObjectId[];
  seatSnapshots: ISeatSnapshot[];
  totalAmountInPaise: number;
  currency: string;
  status: BookingStatus;
  expiresAt: Date;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const seatSnapshotSchema = new Schema<ISeatSnapshot>(
  {
    seatId: { type: Schema.Types.ObjectId, ref: 'ShowSeat', required: true },
    seatLabel: { type: String, required: true },
    category: { type: String, required: true },
    priceInPaise: { type: Number, required: true },
  },
  { _id: false },
);

const bookingSchema = new Schema<IBooking>(
  {
    reference: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    show: {
      type: Schema.Types.ObjectId,
      ref: 'Show',
      required: true,
    },
    seats: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ShowSeat',
        required: true,
      },
    ],
    seatSnapshots: {
      type: [seatSnapshotSchema],
      required: true,
    },
    totalAmountInPaise: {
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
      enum: ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING_PAYMENT',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancellationReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

bookingSchema.index({ reference: 1 }, { unique: true });
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ show: 1, status: 1 });

export const Booking: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', bookingSchema);
