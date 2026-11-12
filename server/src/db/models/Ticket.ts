import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED';

export interface ITicket extends Document {
  reference: string;
  booking: Types.ObjectId;
  showSeat: Types.ObjectId;
  show: Types.ObjectId;
  qrToken: string;
  status: TicketStatus;
  validatedAt?: Date;
  validatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    reference: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    showSeat: {
      type: Schema.Types.ObjectId,
      ref: 'ShowSeat',
      required: true,
    },
    show: {
      type: Schema.Types.ObjectId,
      ref: 'Show',
      required: true,
    },
    qrToken: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['VALID', 'USED', 'CANCELLED'],
      default: 'VALID',
      required: true,
    },
    validatedAt: {
      type: Date,
    },
    validatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  },
);

ticketSchema.index({ reference: 1 }, { unique: true });
ticketSchema.index({ booking: 1 });
ticketSchema.index({ show: 1 });

export const Ticket: Model<ITicket> =
  mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', ticketSchema);
