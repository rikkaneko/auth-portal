import mongoose from 'mongoose';

export interface IUser {
  id: string;
  role: string[];
  username: string;
  linked_email: string;
  fullname: string;
  groups: string[];
  created_by: Date;
  updated_by: Date;
  create_at: Date;
  updated_at: Date;
  status: 'active' | 'disabled' | 'locked';
  organization_id: string;
}

const UserSchema = new mongoose.Schema<IUser>(
  {
    id: String,
    role: [String],
    username: String,
    linked_email: String,
    fullname: String,
    groups: [String],
    created_by: String,
    updated_by: String,
    status: {
      enum: ['active', 'disabled', 'locked'],
    },
    organization_id: String,
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

export const User = mongoose.model<IUser>('user', UserSchema);
