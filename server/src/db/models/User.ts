import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      collation: { locale: 'en', strength: 2 },
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'STAFF', 'ADMIN'],
      default: 'CUSTOMER',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

