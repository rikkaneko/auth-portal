import { RequestHandler, Router, json } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from './models/schema';

import { AuthInfo, AuthInfo$User } from './types';
import config from './config';
import mongoose from 'mongoose';
import { error } from 'console';

const route = Router();

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

route.use(do_auth);

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

route.get('/me', required_auth(), async (req, res) => {
  const result = await User.findOne({ id: req.auth.user?.id }, { groups: 0, _id: 0 });
  if (result === null) {
    res.status(404).json({
      error: {
        code: 404,
        message: 'Current user information is not available',
      },
    });
    return;
  }
  res.json(result);
});

route.get('/groups', required_auth(), async (req, res) => {
  const result = await User.findOne({ id: req.auth.user?.id }, { groups: 1, _id: 0 });
  if (result === null) {
    res.status(404).json({
      error: {
        code: 404,
        message: 'Current user information is not available',
      },
    });
    return;
  }
  res.json(result);
});

route.get('/list/:user_id', required_auth(2), async (req, res) => {
  const result = await User.findOne({ id: req.params.user_id }, { groups: 0, _id: 0 });
  if (result === null) {
    res.status(404).json({
      error: {
        code: 404,
        message: 'User does not exist',
      },
    });
    return;
  }
  res.json(result);
});

route.post('/create', required_auth(2), json(), async (req, res) => {
  const new_user_info: IUser = req.body;
  if (
    req.auth.privilege_level! < 3 && // Require admin
    (new_user_info?.role?.includes('admin') || new_user_info?.role?.includes('teacher'))
  ) {
    res.status(403).json({
      error: {
        code: 403,
        message: 'Permission denied (Assign a new admin role without admin right)',
      },
    });
    return;
  }

  const email = new_user_info?.linked_email?.split('@');
  if (!email || email.length !== 2) {
    res.status(400).json({
      error: {
        code: 400,
        message: 'Invalid data (Invalid email format)',
      },
    });
    return;
  }
  const username = new_user_info?.username ?? email[0];
  const user_id = `${username}`;
  try {
    const result = await User.create({
      ...new_user_info,
      id: user_id,
      username,
      created_by: req.auth.user!.id,
      updated_by: req.auth.user!.id,
    });
    res.json({
      id: result.id,
    });
  } catch (e) {
    if (e instanceof mongoose.Error.ValidationError) {
      const err = e;
      res.status(400).json(err.errors);
    } else if (e instanceof mongoose.mongo.MongoError && e.code === 11000) {
      res.status(409).json({
        error: {
          code: 409,
          message: 'Duplicate user email or username (User already exist)',
        },
      });
    } else {
      res.status(500).json({
        error: {
          code: 500,
          message: 'Unknown error',
        },
      });
      console.error(error);
    }
  }
});

route.post('/delete/:user_id', required_auth(2), async (req, res) => {
  if (!req.auth.is_auth) {
    res.status(403).json({
      error: {
        code: 403,
        message: 'Unauthorized',
      },
    });
    return;
  }
  const user_id = req.params?.user_id;
  if (!user_id) {
    res.status(400).json({
      code: 400,
      message: 'Invalid request (Missing user_id param)',
    });
  }
  try {
    const target_user = await User.findOne({ id: user_id });
    if (!target_user) {
      res.status(404).json({
        error: {
          code: 404,
          message: 'User ID does not exist',
        },
      });
      return;
    }
    if (
      req.auth.privilege_level! < 3 && // Require admin
      (target_user.role?.includes('admin') || target_user.role?.includes('teacher'))
    ) {
      res.status(403).json({
        error: {
          code: 403,
          message: 'Permission denied (Remove an admin or a teacher without admin right)',
        },
      });
      return;
    }
    await User.deleteOne({ id: user_id });
    res.json({});
  } catch (e) {
    if (e instanceof mongoose.Error.ValidationError) {
      const err = e;
      res.status(400).json(err.errors);
    } else if (e instanceof mongoose.mongo.MongoError) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Unable to remove the specific user',
        },
      });
    }
  }
});

route.post('/update/:user_id?', required_auth(), async (req, res) => {
  // TODO
});

export default route;
