import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISeatLayout {
  rows: number;
  columns: number;
  aisleColumns: number[];
  gapSeats: string[];
  rowCategories: Record<string, string>; // e.g. { "A": "SILVER", "B": "SILVER", "C": "GOLD" }
}

export interface IScreen extends Document {
  theatre: Types.ObjectId;
  name: string;
  scheduleVersion: number;
  seatLayout: ISeatLayout;
  isActive: boolean;
  totalSeats: number;
  createdAt: Date;
  updatedAt: Date;
}

const seatLayoutSchema = new Schema<ISeatLayout>(
  {
    rows: { type: Number, required: true, min: 1, max: 26 },
    columns: { type: Number, required: true, min: 1, max: 50 },
    aisleColumns: { type: [Number], default: [] },
    gapSeats: { type: [String], default: [] },
    rowCategories: { type: Map, of: String, default: {} },
  },
  { _id: false },
);

const screenSchema = new Schema<IScreen>(
  {
    theatre: {
      type: Schema.Types.ObjectId,
      ref: 'Theatre',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    scheduleVersion: {
      type: Number,
      default: 0,
    },
    seatLayout: {
      type: seatLayoutSchema,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual totalSeats: (rows * columns) - gapSeats.length
screenSchema.virtual('totalSeats').get(function () {
  if (!this.seatLayout) return 0;
  const total = this.seatLayout.rows * this.seatLayout.columns;
  const gaps = this.seatLayout.gapSeats?.length || 0;
  return Math.max(0, total - gaps);
});

screenSchema.index({ theatre: 1, name: 1 }, { unique: true });

export const Screen: Model<IScreen> =
  mongoose.models.Screen || mongoose.model<IScreen>('Screen', screenSchema);

