import { Router } from 'express';
import config from '../config';
import { OAuth2Client$Userinfo } from '../types';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import { pre_login_handle, render_error_page } from '../util';

const oauth = new OAuth2Client({
  clientId: config.GOOGLE_AUTH_CLIENT_ID,
  clientSecret: config.GOOGLE_AUTH_CLIENT_SECRET,
  redirectUri: config.GOOGLE_AUTH_LOGIN_CALLBACK,
});

const route = Router();

route.use(render_error_page);

route.get('/', pre_login_handle, (req, res) => {
  // Generate a secure random state value.
  req.session.pkce = {
    challenge: crypto.randomBytes(32).toString('hex'),
  };

  const auth_url = oauth.generateAuthUrl({
    access_type: 'online',
    scope: ['email', 'profile', 'openid'],
    prompt: 'select_account',
    // Enable incremental authorization. Recommended as a best practice.
    // include_granted_scopes: true,
    // Include the state parameter to reduce the risk of CSRF attacks.
    state: req.session.pkce.challenge,
  });

  res.redirect(auth_url);
});

route.get('/callback', async (req, res) => {
  const q = req.query;
  if (q.error) {
    console.log('Error:' + q.error);
    res.status(400).json({
      error: {
        code: 400,
        message: `Unable to obtain user identity (${q.error})`,
      },
    });
  } else if (q.state && q.state !== req.session?.pkce?.challenge) {
    console.log('State mismatch. Possible CSRF attack');
    res.status(403).json({
      error: {
        code: 403,
        message: 'CSRF state mismatch',
      },
    });
  } else {
    try {
      // An identifier for the user
      const { tokens } = await oauth.getToken(q.code as string);
      const { sub } = await oauth.getTokenInfo(tokens.access_token!);
      oauth.setCredentials(tokens);
      const { data }: { data: OAuth2Client$Userinfo } = await oauth.request({
        url: 'https://www.googleapis.com/userinfo/v2/me',
        method: 'GET',
      });
      const user = {
        logged: true,
        email: data.email!,
        display_name: data.name!,
        uuid: sub!,
      };
      console.log('\nResponse: \n', user);
      req.session.user = user;
      res.redirect(config.APP_PATH_PREFIX + '/api/auth/token');
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: {
          code: 500,
          mnessage: 'Unable to grant access',
        },
      });
    }
  }
});

export default route;
