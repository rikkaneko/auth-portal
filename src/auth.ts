import { RequestHandler, Router } from 'express';
import jwt from 'jsonwebtoken';

import microsoft from './sso/microsoft';
import google from './sso/google';
import { User } from './models/schema';
import config from './config';
import { AuthInfo$User } from './types';

const route = Router();

route.get('/', (_, res) => {
  res.send('Please select your SSO provider: microsoft, google');
});

route.get('/logout', (req, res) => {
  res.clearCookie('id_token');
  req.session.destroy(() => {
    res.send('Logged out');
  });
});

export const pre_login_handle: RequestHandler = (req, _, next) => {
  req.session.regenerate(() => {
    if (req.query?.redirect_url) {
      req.session.redirect_url = req.query.redirect_url as string;
    }
    next();
  });
};

route.use('/microsoft', microsoft);

route.use('/google', google);

// Example use-case: Verify current login user
route.get('/token_info', (req, res) => {
  if (!req.cookies?.id_token) {
    res.redirect('/auth');
    return;
  }

  try {
    const decoded = jwt.verify(req.cookies?.id_token, config.JWT_VERIFY_KEY, {
      algorithms: ['ES256'],
      issuer: config.JWT_SIGN_ISSUER,
      subject: 'login-auth-token',
      complete: true,
    });
    res.json({
      token: decoded,
    });
  } catch (err) {
    console.error(err);
    res.status(403).send('Invalid token');
  }
});

route.get('/token', async (req, res) => {
  if (!req.session.user?.logged) {
    res.status(403).end('403 Unauthorized');
    return;
  }
  res.clearCookie('id_token');
  // Verify user login information
  const user = await User.findOne({ linked_email: req.session.user.email });
  // Mocked result
  // const user = {
  //   id: 'testuser',
  //   role: ['user'],
  //   username: 'testuser',
  //   linked_email: 'rikkaneko23@gmail.com',
  //   fullname: 'Test User',
  //   status: 'active',
  // };
  if (user === null) {
    res.status(403).send('Logged user is not registed to the system');
    return;
  }
  // Generate and signed id token jwt
  const user_info: AuthInfo$User = {
    id: user.id,
    role: user.role,
    username: user.username,
    email: user.linked_email,
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
  res.status(403).send('403 Unauthorized');
});

export default route;
