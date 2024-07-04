import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { User } from './models/schema';

import { AuthInfo, AuthInfo$User } from './types';
import config from './config';

const route = Router();

route.use((req, res, next) => {
  try {
    if (req.cookies?.id_token) {
      const decoded = jwt.verify(req.cookies.id_token, config.JWT_VERIFY_KEY, {
        algorithms: ['ES256'],
        issuer: config.JWT_SIGN_ISSUER,
        subject: 'login-auth-token',
        complete: true,
      });
      const payload = decoded.payload as AuthInfo$User;
      const auth_info: AuthInfo = {
        is_auth: true,
        token_info: {
          id_token: req.cookies.id_token,
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
    } else {
      const auth_info: AuthInfo = {
        is_auth: false,
      };
      req.auth = auth_info;
    }
  } catch (err) {
    console.error(err);
    res.status(403).json({
      error: {
        code: 403,
        message: 'Invalid token',
      },
    });
  }
  next();
});

route.get('/me', async (req, res) => {
  if (!req.auth.is_auth) {
    res.status(403).send('403 Unauthorized');
    return;
  }
  const result = await User.findOne({ id: req.auth.user?.id }, { groups: 0, _id: 0 });
  if (result === null) {
    res.status(500).send('500 Internal Error');
    return;
  }
  res.json(result);
});

route.get('/groups', async (req, res) => {
  if (!req.auth.is_auth) {
    res.status(403).send('403 Unauthorized');
    return;
  }
  const result = await User.findOne({ id: req.auth.user?.id }, { groups: 1, _id: 0 });
  // Mocked result
  // const result = {
  //   groups: ['polyu:EIE4432_2324S2_1', 'polyu:EIE4108_2324S2_1'],
  // };
  if (result === null) {
    res.status(500).send('500 Internal Error');
    return;
  }
  res.json(result);
});

// Fallback path
route.use((req, res) => {
  res.status(403).send('403 Unauthorized');
});

export default route;
