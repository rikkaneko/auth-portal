import { Router } from 'express';
import jwt from 'jsonwebtoken';

import microsoft from './sso/microsoft';
import google from './sso/google';
import { User } from './models/schema';
import config from './config';

const route = Router();

route.get('/', (req, res) => {
  res.send('Please select your SSO provider: microsoft, google');
});

route.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.send('Logged out');
  });
});

route.use('/microsoft', microsoft);

route.use('/google', google);

// Example use-case: Verify current login user
route.get('/me', (req, res) => {
  if (!req.cookies?.id_token) {
    res.redirect('/auth');
    return;
  }

  try {
    const decoded = jwt.verify(req.cookies?.id_token, config.JWT_VERIFY_KEY, {
      algorithms: ['ES256'],
      issuer: 'auth-portal',
      subject: 'login-auth-token',
      complete: true,
    });
    res.json({
      status: 'ok',
      id_token: decoded,
    });
  } catch (err) {
    console.error(err);
    res.status(403).send('Invalid id token');
  }
});

route.get('/token', async (req, res) => {
  if (!req.session.user?.logged) {
    res.status(403).end();
    return;
  }
  // Verify user login information
  const user = await User.findOne({ linked_email: req.session.user.email });
  // Mocked result
  // const user = {
  //   id: 'testuser',
  //   role: 'user',
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
  const signed = jwt.sign(
    {
      id: user.id,
      role: user.role,
      username: user.username,
      email: user.linked_email,
    },
    config.JWT_SIGN_KEY,
    { algorithm: 'ES256', expiresIn: 4 * 60 * 60, issuer: 'auth-portal', subject: 'login-auth-token' }
  );
  // req.session.destroy(() => {});
  res.cookie('id_token', signed, {
    httpOnly: false,
    // sameSite: 'none',
    domain: 'localhost',
    maxAge: 14400000,
  });
  res.json({
    id: user.id,
    role: user.role,
    username: user.username,
    email: user.linked_email,
    id_token: signed,
  });
});


export default route;
