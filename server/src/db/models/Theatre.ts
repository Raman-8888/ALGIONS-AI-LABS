import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITheatre extends Document {
  name: string;
  city: string;
  address: string;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const theatreSchema = new Schema<ITheatre>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

theatreSchema.index({ city: 1, isActive: 1 });

export const Theatre: Model<ITheatre> =
  mongoose.models.Theatre || mongoose.model<ITheatre>('Theatre', theatreSchema);

