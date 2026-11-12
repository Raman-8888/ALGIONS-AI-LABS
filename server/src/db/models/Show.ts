import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ShowFormat = '2D' | '3D' | 'IMAX';
export type ShowStatus = 'SCHEDULED' | 'CANCELLED';

export interface IShow extends Document {
  movie: Types.ObjectId;
  screen: Types.ObjectId;
  startsAt: Date;
  endsAt: Date;
  language: string;
  format: ShowFormat;
  priceByCategory: Record<string, number>; // e.g. { SILVER: 15000, GOLD: 25000, PLATINUM: 40000 } in integer paise
  currency: string;
  status: ShowStatus;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const showSchema = new Schema<IShow>(
  {
    movie: {
      type: Schema.Types.ObjectId,
      ref: 'Movie',
      required: true,
      index: true,
    },
    screen: {
      type: Schema.Types.ObjectId,
      ref: 'Screen',
      required: true,
      index: true,
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    language: {
      type: String,
      required: true,
      default: 'Hindi',
    },
    format: {
      type: String,
      enum: ['2D', '3D', 'IMAX'],
      default: '2D',
      required: true,
    },
    priceByCategory: {
      type: Map,
      of: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
      required: true,
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'CANCELLED'],
      default: 'SCHEDULED',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

showSchema.virtual('isCompleted').get(function () {
  return new Date() > this.endsAt;
});

showSchema.index({ screen: 1, startsAt: 1, endsAt: 1 });
showSchema.index({ movie: 1, startsAt: 1 });

export const Show: Model<IShow> =
  mongoose.models.Show || mongoose.model<IShow>('Show', showSchema);

