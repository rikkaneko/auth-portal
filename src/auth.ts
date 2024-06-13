import { Router } from 'express';
import microsoft from './sso/microsoft';
import google from './sso/google';

const route = Router();

route.get('/', (req, res) => {
  res.send('Please select your SSO provider: microsoft, google');
});

route.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.send('Logged out');
  });
});

route.use('/microsoft', microsoft);

route.use('/google', google);

export default route;
