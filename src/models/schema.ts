import { Schema } from 'mongoose';
import db from '../dbclient';
import { email_validator } from '../util';

export interface IUser$TokenInfo {
  token: string;
  expiration: Date;
  created_at: Date;
  updated_at: Date;
}

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
  refresh_tokens: IUser$TokenInfo[];
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
      unique: true,
    },
    linked_email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: email_validator,
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
    refresh_tokens: [
      new Schema<IUser$TokenInfo>(
        {
          token: {
            type: String,
            index: true,
            required: true,
          },
          expiration: {
            type: Date,
            required: true,
          },
        },
        {
          timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
          },
        }
      ),
    ],
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

export const User = db.model<IUser>('user', UserSchema);
