import { RequestHandler, Router } from 'express';
import jwt from 'jsonwebtoken';

import microsoft from './sso/microsoft';
import google from './sso/google';
import { User } from './models/schema';
import config from './config';
import { AuthInfo, AuthInfo$User } from './types';

const route = Router();

export const pre_login_handle: RequestHandler = (req, _, next) => {
  req.session.regenerate(() => {
    if (req.query?.redirect_url) {
      req.session.redirect_url = req.query.redirect_url as string;
    }
    if (req.query?.failed_redirect_url) {
      req.session.failed_redirect_url = req.query.failed_redirect_url as string;
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

export const do_auth: RequestHandler = (req, res, next) => {
  try {
    let id_token: string | undefined = undefined;
    if (req.headers?.authorization) {
      const authorization = req.headers.authorization.split('\x20');
      if (authorization.length === 2 && authorization[0] == 'Bearer') id_token = authorization[1];
    } else if (req.cookies?.id_token) {
      id_token = req.cookies.id_token;
    }
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

route.get('/logout', (req, res) => {
  res.clearCookie('id_token');
  req.session.destroy(() => {
    if (req.query?.redirect_url) {
      res.redirect(req.query.redirect_url as string);
    } else res.json({});
  });
});

route.use('/microsoft', microsoft);

route.use('/google', google);

// Example use-case: Verify current login user
route.get('/token_info', do_auth, required_auth(), (req, res) => {
  res.json({
    token: req.auth.token_info,
  });
});

route.get('/token', async (req, res) => {
  if (!req.session.user?.logged) {
    res.status(403).json({
      error: {
        code: 403,
        message: 'Unauthorized',
      },
    });
    return;
  }
  res.clearCookie('id_token', {
    // sameSite: 'none',
    domain: config.APP_DOMAIN,
  });
  // Verify user login information
  const user = await User.findOne({ linked_email: req.session.user.email });
  if (user === null) {
    // Invalidate old session
    req.session.destroy(() => {});
    const redirect_url = req.session.failed_redirect_url;
    if (redirect_url) {
      res.redirect(redirect_url);
    } else {
      res.status(403).json({
        error: {
          code: 403,
          message: 'Logged user is not registed to the system',
        },
      });
    }
    return;
  }
  // Generate and signed id token jwt
  const user_info: AuthInfo$User = {
    id: user.id,
    role: user.role,
    username: user.username,
    email: user.linked_email,
    organization: user.organization,
  };
  const signed = jwt.sign(user_info, config.JWT_SIGN_KEY, {
    algorithm: 'ES256',
    expiresIn: 4 * 60 * 60,
    issuer: config.JWT_SIGN_ISSUER,
    subject: 'login-auth-token',
  });
  res.cookie('id_token', signed, {
    httpOnly: false,
    // sameSite: 'none',
    domain: config.APP_DOMAIN,
    maxAge: 14400000,
  });
  const redirect_url = req.session.redirect_url;
  // Invalidate old session
  req.session.destroy(() => {});
  if (redirect_url) {
    res.redirect(`${redirect_url}?auth_token=${signed}`);
  } else {
    res.json({
      id_token: signed,
    });
  }
});

// Fallback path
route.use((req, res) => {
  res.status(403).json({
    error: {
      code: 403,
      message: 'Unauthorized',
    },
  });
});

export default route;
