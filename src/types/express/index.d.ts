import 'express';
import { AuthInfo } from '..';

declare global {
  namespace Express {
    interface Request {
      auth: AuthInfo;
    }
  }
}

// Add new fields to session data
declare module 'express-session' {
  interface SessionData {
    redirect_url?: string;
    failed_redirect_url?: string;
    need_refresh_token?: boolean;
    panel?: boolean;
    pkce?: {
      verifier?: string;
      challenge?: string;
      challenge_method?: string;
    };
    user?: {
      logged: boolean;
      email: string;
      display_name?: string;
      uuid: string;
    };
  }
}
