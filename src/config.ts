import dotenv from 'dotenv';

dotenv.config();

export default {
  MS_CLIENT_ID: process.env.MS_CLIENT_ID!,
  MS_CLIENT_SECRET: process.env.MS_CLIENT_SECRET!,
  MS_DIRECTORY_URL: process.env.MS_DIRECTORY_URL ?? 'https://login.microsoftonline.com/common',
  MS_AUTH_LOGIN_CALLBACK: process.env.MS_AUTH_LOGIN_CALLBACK!,
};
