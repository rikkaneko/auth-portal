import { Schema } from 'mongoose';
import db from '../dbclient';
import { email_validator } from '../util';

export interface IUser$TokenInfo {
  token: string;
  expiration: Date;
  created_at: Date;
  updated_at: Date;
}

export interface IUser$GroupWithRoles {
  id: string;
  role?: string[];
}

export interface IUser {
  id: string;
  role: string[];
  username: string;
  linked_email: string;
  fullname?: string;
  groups: IUser$GroupWithRoles[];
  created_by?: string;
  updated_by?: string;
  create_at: Date;
  updated_at: Date;
  status: 'active' | 'disabled' | 'locked';
  organization: string;
  refresh_tokens: IUser$TokenInfo[];
}

interface IGroupMeta {
  course_description?: string;
  course_code: string;
  course_year: string;
  active: boolean;
}

export interface IGroup {
  id: string;
  name: string;
  type: 'course' | 'default';
  meta: Record<string, string | number | boolean>; // TODO: use IGroupMeta
  created_by?: string;
  updated_by?: string;
  organization: string;
  create_at: Date;
  updated_at: Date;
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
    groups: [
      new Schema<IUser$GroupWithRoles>(
        {
          id: {
            type: String,
            required: true,
          },
          role: {
            type: [String],
            validate: (v: string) => Array.isArray(v) && v.length > 0,
          },
        },
        { _id: false }
      ),
    ],
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
          _id: false,
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

const GroupSchema = new Schema<IGroup>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['default', 'course'],
      default: 'default',
    },
    meta: Schema.Types.Mixed,
    created_by: String,
    updated_by: String,
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

export const Group = db.model<IGroup>('group', GroupSchema);
