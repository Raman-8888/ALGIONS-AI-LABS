import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMovie extends Document {
  title: string;
  description: string;
  durationMinutes: number;
  languages: string[];
  genres: string[];
  posterUrl: string;
  trailerUrl?: string;
  releaseDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const movieSchema = new Schema<IMovie>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    languages: {
      type: [String],
      required: true,
      default: ['Hindi'],
    },
    genres: {
      type: [String],
      required: true,
      default: [],
    },
    posterUrl: {
      type: String,
      required: true,
      trim: true,
    },
    trailerUrl: {
      type: String,
      trim: true,
      default: '',
    },
    releaseDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

movieSchema.index({ title: 'text' });
movieSchema.index({ genres: 1 });
movieSchema.index({ languages: 1 });
movieSchema.index({ releaseDate: 1 });
movieSchema.index({ isActive: 1 });

export const Movie: Model<IMovie> =
  mongoose.models.Movie || mongoose.model<IMovie>('Movie', movieSchema);

