import express from 'express';
import config from './config';
import auth from './auth';
import client from './dbclient';

import session from 'express-session';
import mongostore from 'connect-mongo';
import { MongoClient } from 'mongodb';

const app = express().disable('x-powered-by');

// Add new fields to session data
declare module 'express-session' {
  interface SessionData {
    state?: string;
    pkce?: {
      codes?: string;
      verifier?: string;
      challenge?: string;
      challenge_method?: string;
    };
    user?: {
      logged: boolean;
      email: string;
      display_name?: string;
      uuid: string;
    };
    id_token?: string;
  }
}

app.use(
  session({
    secret: config.SESSION_SECRET_KEY,
    name: 'sessionId',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 14400000, // 4 hours
    },
    store: mongostore.create({
      client: client.connection.getClient() as any,
      dbName: 'auth-portal',
      collectionName: 'session',
    }),
  })
);

app.get('/', (req, res) => {
  if (!req.session.user?.logged) {
    res.redirect('/auth');
    return;
  }
  res.redirect('/me');
});

app.use('/auth', auth);

app.get('/me', (req, res) => {
  if (!req.session.user?.logged) {
    res.redirect('/auth');
    return;
  }
  const user = req.session.user;
  res.json({
    status: 'ok',
    user: {
      username: user.email,
      display_name: user.display_name,
      uuid: user.uuid,
    },
  });
});

app.listen(config.APP_PORT, () => {
  console.log(`Server started at http://localhost:8088`);
});
