import { Router } from 'express';

const route = Router();

route.use('/', (req, res) => {
  res.send('This endpoint is under maintenance.');
});

export default route;
