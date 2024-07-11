import { Router } from 'express';
import config from '../config';
import {
  ConfidentialClientApplication,
  CryptoProvider,
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
} from '@azure/msal-node';
import { pre_login_handle } from '../util';

// Refer to OpenID Connect on the Microsoft identity platform (https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)
// Use https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference to verify user identity
const msal = new ConfidentialClientApplication({
  auth: {
    clientId: config.MS_AUTH_CLIENT_ID, // Application (client) ID
    clientSecret: config.MS_AUTH_CLIENT_SECRET, // Client secret
    authority: config.MS_AUTH_DIRECTORY_URL, // Full directory URL, in the form of https://login.microsoftonline.com/<tenant>
  },
});

const route = Router();

route.get('/', pre_login_handle, async (req, res) => {
  const crypt = new CryptoProvider();
  const { challenge, verifier } = await crypt.generatePkceCodes();
  if (!req.session?.pkce) {
    req.session.pkce = {
      challenge_method: 'S256',
    };
  }

  req.session.pkce.challenge = challenge;
  req.session.pkce.verifier = verifier;

  const auth_code_url_params: AuthorizationUrlRequest = {
    scopes: ['User.Read', 'email', 'profile', 'openid'],
    redirectUri: config.MS_AUTH_LOGIN_CALLBACK,
    codeChallenge: challenge, // PKCE Code Challenge
    codeChallengeMethod: req.session.pkce.challenge_method, // PKCE Code Challenge Method,
    prompt: 'select_account',
  };

  try {
    const login_url = await msal.getAuthCodeUrl(auth_code_url_params);
    res.redirect(login_url);
  } catch (err) {
    console.log(err);
  }
});

route.get('/callback', async (req, res) => {
  // Add PKCE code verifier to token request object
  if (!req.session?.pkce) {
    res.status(400).json({
      error: {
        code: 400,
        message: 'Invalid Request',
      },
    });
    return;
  }

  const token_request: AuthorizationCodeRequest = {
    code: req.query.code as string,
    scopes: ['User.Read', 'email', 'profile', 'openid'],
    redirectUri: config.MS_AUTH_LOGIN_CALLBACK,
    codeVerifier: req.session.pkce.verifier, // PKCE Code Verifier
    clientInfo: req.query.client_info as string,
  };

  try {
    const auth_reply = await msal.acquireTokenByCode(token_request);
    const claims = auth_reply.account?.idTokenClaims;
    const user = {
      logged: true,
      email: claims!.preferred_username!,
      display_name: claims?.name,
      uuid: claims!.oid!,
    };
    console.log('\nResponse: \n', user);
    req.session.user = user;
    res.redirect(config.APP_PATH_PREFIX + '/api/auth/token');
  } catch (err) {
    console.log('State mismatch. Possible CSRF attack');
    console.log(err);
    res.status(500).json({
      error: {
        code: 500,
        message: 'CSRF state mismatch',
      },
    });
  }
});

export default route;
