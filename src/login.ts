import { Router } from 'express';
import microsoft from './sso/microsoft';
import google from './sso/google';

const route = Router();

route.get('/', (req, res) => {
  res.redirect('/login/microsoft');
});

route.use('/microsoft', microsoft);

route.use('/google', google);

export default route;
