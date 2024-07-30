import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import config from './config';
import { AuthInfo, AuthInfo$User } from './types';
import { IUser } from './models/schema';

export const email_validator = /^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;

export const pre_login_handle: RequestHandler = (req, _, next) => {
  req.session.regenerate(() => {
    if (req.query?.redirect_url) {
      req.session.redirect_url = req.query.redirect_url as string;
    }
    if (req.query?.failed_redirect_url) {
      req.session.failed_redirect_url = req.query.failed_redirect_url as string;
    }
    if (req.query?.refresh_token === '1') {
      req.session.need_refresh_token = true;
    }
    if (req.query?.panel === '1') {
      req.session.panel = true;
    }
    next();
  });
};

export const verify_token = (id_token?: string) => {
  if (!id_token) return null;
  try {
    const decoded = jwt.verify(id_token, config.JWT_VERIFY_KEY, {
      algorithms: ['ES256'],
      issuer: config.JWT_SIGN_ISSUER,
      subject: 'login-auth-token',
      complete: true,
    });
    return decoded;
  } catch (e) {
    if (e instanceof Error) console.error(e.message);
    return null;
  }
};

export const get_token = (req: Parameters<RequestHandler>[0], field_name: string = 'id_token') => {
  let token: string | undefined = undefined;
  if (req.headers?.authorization) {
    const authorization = req.headers.authorization.split('\x20');
    if (authorization.length === 2 && authorization[0] == 'Bearer') token = authorization[1];
  } else if (req.cookies?.[field_name]) {
    token = req.cookies[field_name];
  }
  return token;
};

export const do_auth: RequestHandler = (req, res, next) => {
  try {
    const id_token = get_token(req, 'id_token');
    const decoded = verify_token(id_token);
    if (decoded == null) {
      const auth_info: AuthInfo = {
        is_auth: false,
      };
      req.auth = auth_info;
      next();
      return;
    }
    const payload = decoded.payload as AuthInfo$User;
    const auth_info: AuthInfo = {
      is_auth: true,
      token_info: {
        id_token: id_token!,
        ...decoded,
      },
      user: {
        id: payload.id,
        email: payload.email,
        username: payload.username,
        role: payload.role,
        organization: payload.organization,
      },
    };
    const plv = auth_info.user?.role.includes('admin') // admin - 3
      ? 3
      : auth_info.user?.role.includes('teacher') // teacher - 2
        ? 2
        : auth_info.user?.role.includes('student') // student - 1
          ? 1
          : 0;
    auth_info.privilege_level = plv;
    req.auth = auth_info;
  } catch (e) {
    if (e instanceof Error) console.error(e.message);
    res.status(403).json({
      error: {
        code: 403,
        message: 'Invalid token',
      },
    });
  }
  next();
};

export const required_auth: (min_privilege_level?: number) => RequestHandler =
  (min_privilege_level: number = 0) =>
  (req, res, next) => {
    if (!req.auth) {
      console.error('Not loaded do_auth middleware (Possibly bug)');
      res.status(500).json({
        error: {
          code: 500,
          message: 'Internal Error',
        },
      });
      return;
    }
    if (!req.auth.is_auth || (min_privilege_level !== undefined && req.auth.privilege_level! < min_privilege_level)) {
      res.status(403).json({
        error: {
          code: 403,
          message: 'Unauthorized',
        },
      });
      return;
    }
    next();
  };

export const sign_token = (user: IUser) => {
  // Generate and signed id token jwt
  const user_info: AuthInfo$User = {
    id: user.id,
    role: user.role,
    username: user.username,
    email: user.linked_email,
    organization: user.organization,
  };
  return jwt.sign(user_info, config.JWT_SIGN_KEY, {
    algorithm: 'ES256',
    expiresIn: 4 * 60 * 60,
    issuer: config.JWT_SIGN_ISSUER,
    subject: 'login-auth-token',
  });
};
