import { Router } from 'express';
import config from '../config';
import {
  ConfidentialClientApplication,
  CryptoProvider,
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
} from '@azure/msal-node';

// Refer to OpenID Connect on the Microsoft identity platform (https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)
// Use https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference to verify user identity
const msal = new ConfidentialClientApplication({
  auth: {
    clientId: config.MS_CLIENT_ID, // Application (client) ID
    clientSecret: config.MS_CLIENT_SECRET, // Client secret
    authority: config.MS_DIRECTORY_URL, // Full directory URL, in the form of https://login.microsoftonline.com/<tenant>
  },
});

const route = Router();

// Add new fields to session data
declare module 'express-session' {
  interface SessionData {
    pkce?: {
      codes?: string;
      verifier?: string;
      challenge?: string;
      challenge_method?: string;
    };
    user?: {
      logged?: boolean;
      username?: string;
      display_name?: string;
      uuid?: string;
      id_token?: string;
      access_token?: string;
    };
  }
}

route.get('/', async (req, res) => {
  const crypt = new CryptoProvider();
  const { challenge, verifier } = await crypt.generatePkceCodes();
  if (!req.session.pkce) {
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
    console.log(JSON.stringify(err));
  }
});

route.get('/callback', async (req, res) => {
  // Add PKCE code verifier to token request object
  const token_request: AuthorizationCodeRequest = {
    code: req.query.code as string,
    scopes: ['User.Read', 'email', 'profile', 'openid'],
    redirectUri: config.MS_AUTH_LOGIN_CALLBACK,
    codeVerifier: req.session.pkce!.verifier, // PKCE Code Verifier
    clientInfo: req.query.client_info as string,
  };

  try {
    const auth_reply = await msal.acquireTokenByCode(token_request);
    const claims = auth_reply.account?.idTokenClaims;
    const user = {
      logged: true,
      username: claims?.preferred_username,
      display_name: claims?.name,
      uuid: claims?.oid,
      id_token: auth_reply.idToken,
      access_token: auth_reply.accessToken,
    };
    console.log('\nResponse: \n', user);
    req.session.user = user;
    res.json({
      status: 'ok',
      user,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      status: 'failed',
      error: err,
    });
  }
});

export default route;
