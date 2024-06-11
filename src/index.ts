import express from 'express';
import './config';
import login from './login';
import session from 'express-session';

const app = express().disable('x-powered-by');

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

app.use(
  session({
    secret: process.env.SESSION_SECRET_KEY!,
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
    },
  })
);

app.get('/', (req, res) => {
  if (!req.session.user?.logged) {
    res.redirect('/login');
    return;
  }
  res.redirect('/me');
});

app.use('/login', login);

app.get('/me', (req, res) => {
  if (!req.session.user?.logged) {
    res.redirect('/login');
    return;
  }
  const user = req.session.user;
  res.json({
    status: 'ok',
    user: {
      username: user.username,
      display_name: user.display_name,
      uuid: user.uuid,
    },
  });
});

app.listen(8088, () => {
  console.log(`Server started at http://localhost:8088`);
});
