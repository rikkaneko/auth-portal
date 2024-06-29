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
    state?: string;
    pkce?: {
      codes?: string;
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