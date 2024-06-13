import dotenv from 'dotenv';

dotenv.config();

const APP_PORT = process.env.APP_PORT ?? '8088';
const APP_DOMAIN = process.env.APP_DOMAIN ?? `http://localhost:${APP_PORT}`;

const config = {
  APP_DOMAIN,
  APP_PORT,
  SESSION_SECRET_KEY: process.env.SESSION_SECRET_KEY,
  MS_AUTH_CLIENT_ID: process.env.MS_AUTH_CLIENT_ID!,
  MS_AUTH_CLIENT_SECRET: process.env.MS_AUTH_CLIENT_SECRET!,
  MS_AUTH_DIRECTORY_URL: process.env.MS_AUTH_DIRECTORY_URL ?? 'https://login.microsoftonline.com/common',
  MS_AUTH_LOGIN_CALLBACK: process.env.MS_AUTH_LOGIN_CALLBACK ?? `${APP_DOMAIN}/auth/microsoft/callback`,
  GOOGLE_AUTH_CLIENT_ID: process.env.GOOGLE_AUTH_CLIENT_ID!,
  GOOGLE_AUTH_CLIENT_SECRET: process.env.GOOGLE_AUTH_CLIENT_SECRET!,
  GOOGLE_AUTH_LOGIN_CALLBACK: process.env.GOOGLE_AUTH_LOGIN_CALLBACK ?? `${APP_DOMAIN}/auth/google/callback`,
};

if (
  !config.MS_AUTH_CLIENT_ID ||
  !config.MS_AUTH_CLIENT_SECRET ||
  !config.GOOGLE_AUTH_CLIENT_ID ||
  !config.GOOGLE_AUTH_CLIENT_SECRET
) {
  console.error(
    'Missing required environment variables: MS_AUTH_CLIENT_ID, MS_AUTH_CLIENT_SECRET, GOOGLE_AUTH_CLIENT_ID, GOOGLE_AUTH_CLIENT_SECRET'
  );
  process.exit(1);
}

export default config;