import express, { ErrorRequestHandler } from 'express';
import 'express-async-errors';
import config from './config';
import auth from './auth';
import user from './user';
import client from './dbclient';

import session from 'express-session';
import cookie_parser from 'cookie-parser';
import mongostore from 'connect-mongo';

const app = express().disable('x-powered-by');

app.use(
  session({
    secret: config.SESSION_SECRET_KEY,
    name: 'sessionId',
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      maxAge: 5 * 60 * 1000, // 5 min
    },
    store: mongostore.create({
      client: client.connection.getClient() as any,
      dbName: 'auth-portal',
      collectionName: 'session',
    }),
  })
);

app.use(cookie_parser());

app.get('/', (req, res) => {
  if (!req.session.user?.logged) {
    res.redirect('/auth');
    return;
  }
  res.redirect('/auth/me');
});

app.use('/auth', auth);

app.use('/user', user);

// Fallback path
app.use((req, res) => {
  res.status(403).json({
    error: {
      code: 403,
      message: 'Endpoint not found',
    },
  });
});

app.use(((err, req, res) => {
  console.error(err.stack);
  res.status(500).json({
    error: {
      code: 500,
      message: 'Internal error',
    },
  });
  console.error(err);
}) as ErrorRequestHandler);

app.listen(config.APP_PORT, () => {
  console.log(`Server started at http://localhost:8088`);
});
