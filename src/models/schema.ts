import { Schema } from 'mongoose';
import db from '../dbclient';

export interface IUser {
  id: string;
  role: string[];
  username: string;
  linked_email: string;
  fullname?: string;
  groups: string[];
  created_by?: string;
  updated_by?: string;
  create_at: Date;
  updated_at: Date;
  status: 'active' | 'disabled' | 'locked';
  organization: string;
}

const UserSchema = new Schema<IUser>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: [String],
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    linked_email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,5})+$/,
    },
    fullname: String,
    groups: [String],
    created_by: String,
    updated_by: String,
    status: {
      type: String,
      enum: ['active', 'disabled', 'locked'],
      default: 'active',
    },
    organization: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

export const User = db.model<IUser>('user', UserSchema);
