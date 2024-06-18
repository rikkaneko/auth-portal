import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const APP_PORT = process.env.APP_PORT ?? '8088';
const APP_DOMAIN = process.env.APP_DOMAIN ?? `http://localhost:${APP_PORT}`;

const config = {
  APP_DOMAIN, // Server Domain
  APP_PORT, // Server Port
  SESSION_SECRET_KEY: process.env.SESSION_SECRET_KEY ?? crypto.randomBytes(32).toString('hex'), // Session key for express-session (Default: Random generated 32 byte key)
  MS_AUTH_CLIENT_ID: process.env.MS_AUTH_CLIENT_ID!, // OAuth2 Client ID for Microsoft SSO
  MS_AUTH_CLIENT_SECRET: process.env.MS_AUTH_CLIENT_SECRET!, // OAuth2 Client Secret for Microsoft SSO
  MS_AUTH_DIRECTORY_URL: process.env.MS_AUTH_DIRECTORY_URL ?? 'https://login.microsoftonline.com/common', // Microsoft SSO Directory URL
  MS_AUTH_LOGIN_CALLBACK: process.env.MS_AUTH_LOGIN_CALLBACK ?? `${APP_DOMAIN}/auth/microsoft/callback`, // Callback path for Microsoft SSO (Need to as same as the registered URL)
  GOOGLE_AUTH_CLIENT_ID: process.env.GOOGLE_AUTH_CLIENT_ID!, // OAuth2 Client ID for Google SSO
  GOOGLE_AUTH_CLIENT_SECRET: process.env.GOOGLE_AUTH_CLIENT_SECRET!, // OAuth2 Client Secret for Google SSO
  GOOGLE_AUTH_LOGIN_CALLBACK: process.env.GOOGLE_AUTH_LOGIN_CALLBACK ?? `${APP_DOMAIN}/auth/google/callback`, // Callback path for Google SSO (Need to as same as the registered URL)
  CONNECTION_STR: process.env.CONNECTION_STR!, // Connection String to MongoDB Instance (Either self-hosted or MongoDB Atlas)
  /* JWT Signing Key
   * ES256 - ECDSA with the P-256 curve and the SHA-256 hash function
   * Default path: sever.{pem,pub}
   * You are generate the key with the following commands:
   * >> openssl ecparam -name prime256v1 -genkey -noout -out server.pem // Private Key
   * >> openssl ec -in server.pem -pubout > server.pub // Public
   */
  JWT_SIGN_KEY: process.env.JWT_SIGN_KEY ?? './server.pem',
  JWT_VERIFY_KEY: process.env.JWT_VERIFY_KEY! ?? './server.pub',
};

if (
  !config.MS_AUTH_CLIENT_ID ||
  !config.MS_AUTH_CLIENT_SECRET ||
  !config.GOOGLE_AUTH_CLIENT_ID ||
  !config.GOOGLE_AUTH_CLIENT_SECRET ||
  !config.CONNECTION_STR
) {
  console.error(
    'Missing required environment variables: MS_AUTH_CLIENT_ID, MS_AUTH_CLIENT_SECRET, GOOGLE_AUTH_CLIENT_ID, GOOGLE_AUTH_CLIENT_SECRET, CONNECTION_STR'
  );
  process.exit(1);
}

if (!fs.existsSync(config.JWT_SIGN_KEY) || !fs.existsSync(config.JWT_VERIFY_KEY)) {
  console.error('Missing JWT Signing Key (server.pem) or Public key (server.pub)');
  process.exit(1);
}

try {
  config.JWT_SIGN_KEY = fs.readFileSync(config.JWT_SIGN_KEY, 'utf-8');
  config.JWT_VERIFY_KEY = fs.readFileSync(config.JWT_VERIFY_KEY, 'utf-8');
} catch (err) {
  console.error('Unable to read JWT Signing Key (server.pem) or Public key (server.pub)');
  process.exit(1);
}

export default config;