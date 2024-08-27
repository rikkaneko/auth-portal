import { Jwt } from 'jsonwebtoken';

// From https://github.com/googleapis/google-api-nodejs-client/blob/main/src/apis/oauth2/v2.ts:227
export interface OAuth2Client$Userinfo {
  email?: string | null;
  family_name?: string | null;
  gender?: string | null;
  given_name?: string | null;
  hd?: string | null;
  id?: string | null;
  link?: string | null;
  locale?: string | null;
  name?: string | null;
  picture?: string | null;
  verified_email?: boolean | null;
}

export interface AuthInfo$User {
  id: string;
  role: string[];
  username: string;
  email: string;
  organization: string;
}

export interface AuthInfo {
  is_auth: boolean;
  token_info?: Jwt & {
    id_token: string;
  };
  user?: AuthInfo$User;
  privilege_level?: number;
}

export interface AuthResponse {
  auth_token: string;
  refresh_token?: string;
  expiration?: number; // Timestamp (in milliseconds)
}

export interface ImportGroupInput {
  default: {
    user_role: string[];
    group_role: string[];
  };
  members: {
    linked_email: string;
    fullname?: string;
    user_role?: string[];
    group_role?: string[];
  }[];
}
