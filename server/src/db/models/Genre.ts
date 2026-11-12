import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGenre extends Document {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const genreSchema = new Schema<IGenre>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Genre: Model<IGenre> =
  mongoose.models.Genre || mongoose.model<IGenre>('Genre', genreSchema);

