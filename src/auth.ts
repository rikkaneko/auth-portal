import { Router } from 'express';
import crypto from 'crypto';

import microsoft from './sso/microsoft';
import google from './sso/google';
import { User } from './models/schema';
import config from './config';
import { AuthResponse } from './types';
import { do_auth, get_token, required_auth, sign_token } from './util';
import mongoose from 'mongoose';

const route = Router();

// For frontend logout
route.get('/logout', (req, res) => {
  res.clearCookie('id_token', {
    // sameSite: 'none',
    domain: config.APP_DOMAIN,
  });
  req.session.destroy(() => {
    if (req.query?.redirect_url) {
      res.redirect(req.query.redirect_url as string);
    } else res.json({});
  });
});

// Microsoft SSO Login
route.use('/microsoft', microsoft);

// Google SSO Login
route.use('/google', google);

// Example use-case: Verify current login user
route.get('/token_info', do_auth, required_auth(), (req, res) => {
  res.json({
    token: req.auth.token_info,
  });
});

// Retrieve access token (and refresh token if specified with need_refresh_token=1 in login request) after login
// Can only call once
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
  try {
    // Verify user login information
    const user = await User.findOne({ linked_email: req.session.user.email });
    if (user === null) {
      const redirect_url = req.session?.failed_redirect_url;
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
    if (user.status !== 'active') {
      res.status(403).json({
        error: {
          code: 403,
          message: 'This account cannot be used to login',
        },
      });
      return;
    }
    const signed_token = sign_token(user);
    const auth_response: AuthResponse = {
      auth_token: signed_token,
    };
    if (req.session.need_refresh_token === true) {
      const refresh_token = crypto.randomBytes(64).toString('base64');
      const expiration = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours
      await User.updateOne(
        { id: user.id },
        {
          $push: {
            refresh_tokens: {
              token: refresh_token,
              expiration,
            },
          },
        }
      );
      // Append the refresh token to the response
      auth_response.refresh_token = refresh_token;
      auth_response.expiration = expiration.getTime();
    }
    const redirect_url = req.session.redirect_url;
    const to_panel = req.session.panel;
    // Invalidate old session
    req.session.destroy(() => {
      if (redirect_url) {
        res.redirect(
          `${redirect_url}?${new URLSearchParams(
            Object.fromEntries(Object.entries(auth_response).map(([k, v]) => [k, v.toString()]))
          )}`
        );
      } else if (to_panel) {
        // Set access token
        res.cookie('id_token', signed_token, {
          httpOnly: true,
          // sameSite: 'none',
          domain: config.APP_DOMAIN,
          maxAge: 14400000,
        });
        if (auth_response.refresh_token) {
          // Set access token
          res.cookie('id_refresh_token', auth_response.refresh_token, {
            httpOnly: true,
            // sameSite: 'none',
            domain: config.APP_DOMAIN,
            expires: new Date(auth_response.expiration!),
          });
        }
        res.redirect(config.APP_PATH_PREFIX + '/frontend/panel');
      } else {
        res.json(auth_response);
      }
    });
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoError && e.code) {
      res.status(400).json({
        error: {
          code: 400,
          message: e.message,
        },
      });
    } else {
      res.status(500).json({
        error: {
          code: 500,
          message: 'Internal error',
        },
      });
      console.error(e);
    }
  }
});

// Retrieve access token with refresh token
route.post('/token', async (req, res) => {
  try {
    const token = get_token(req, 'id_refresh_token');
    const user = await User.findOne(
      { 'refresh_tokens.token': token },
      {
        groups: 0,
        _id: 0,
        refresh_tokens: {
          $elemMatch: { token },
        },
      }
    );
    if (user === null) {
      res.status(403).json({
        error: {
          code: 403,
          message: 'Invalid token',
        },
      });
      return;
    }
    if (user.status !== 'active') {
      res.status(403).json({
        error: {
          code: 403,
          message: `This account has been ${user.status}`,
        },
      });
    }
    if (user.refresh_tokens[0].expiration < new Date()) {
      await User.updateOne({ id: user.id }, { $pull: { refresh_tokens: { token } } });
      res.status(401).json({
        error: {
          code: 401,
          message: 'Token exprired',
        },
      });
      return;
    }
    const signed_token = sign_token(user);
    res.json({
      auth_token: signed_token,
    });
  } catch (e) {
    res.status(500).json({
      error: {
        code: 500,
        message: 'Internal error',
      },
    });
    console.error(e);
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
