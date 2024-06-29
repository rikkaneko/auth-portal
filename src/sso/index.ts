import { RequestHandler } from 'express';

export const pre_login_handle: RequestHandler = (req, _, next) => {
  req.session.regenerate(() => {
    if (req.query?.redirect_url) {
      req.session.redirect_url = req.query.redirect_url as string;
    }
    next();
  });
};
