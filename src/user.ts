import { Router, json } from 'express';
import { User, IUser } from './models/schema';
import mongoose from 'mongoose';
import { do_auth, required_auth } from './auth';

const route = Router();

route.use(do_auth);

route.get('/me', required_auth(), async (req, res) => {
  const result = await User.findOne({ id: req.auth.user?.id }, { groups: 0, _id: 0 });
  if (result === null) {
    res.status(404).json({
      error: {
        code: 404,
        message: 'Current user information is not available',
      },
    });
    return;
  }
  res.json(result);
});

route.get('/groups', required_auth(), async (req, res) => {
  const result = await User.findOne({ id: req.auth.user?.id }, { groups: 1, _id: 0 });
  if (result === null) {
    res.status(404).json({
      error: {
        code: 404,
        message: 'Current user information is not available',
      },
    });
    return;
  }
  res.json(result);
});

route.get('/list/:user_id', required_auth(2), async (req, res) => {
  const result = await User.findOne({ id: req.params.user_id }, { groups: 0, _id: 0 });
  if (result === null) {
    res.status(404).json({
      error: {
        code: 404,
        message: 'User does not exist',
      },
    });
    return;
  }
  res.json(result);
});

route.get('/list', required_auth(2), async (req, res) => {
  const result = await User.find({}, { groups: 0, _id: 0 });
  res.json(result);
});

route.post('/create', required_auth(2), json(), async (req, res) => {
  const allowed_fields = ['role', 'username', 'linked_email', 'fullname', 'status'];
  const new_user_info: IUser = req.body;
  if (
    req.auth.privilege_level! < 3 && // Require admin
    (new_user_info?.role?.includes('admin') || new_user_info?.role?.includes('teacher'))
  ) {
    res.status(403).json({
      error: {
        code: 403,
        message: 'Permission denied (Assign a new admin role without admin right)',
      },
    });
    return;
  }

  const email = new_user_info?.linked_email?.split('@');
  if (!email || email.length !== 2) {
    res.status(400).json({
      error: {
        code: 400,
        message: 'Invalid data (Invalid email format)',
      },
    });
    return;
  }
  const username = new_user_info?.username ?? email[0];
  const user_id = `${username}`;
  try {
    // Validate update data fields
    if (!Object.keys(new_user_info).every((key) => allowed_fields.includes(key))) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Invalid data (Invalid data fields)',
          allowed_fields,
        },
      });
      return;
    }
    const result = await User.create({
      ...new_user_info,
      id: user_id,
      username,
      created_by: req.auth.user!.id,
      updated_by: req.auth.user!.id,
    });
    res.json({
      id: result.id,
    });
  } catch (e) {
    if (e instanceof mongoose.Error.ValidationError) {
      const errors = Object.fromEntries(
        Object.entries(e.errors as Record<string, mongoose.Error.ValidatorError>).map(([key, value]) => [
          key,
          value.message,
        ])
      );
      res.status(400).json({
        error: {
          code: 400,
          errors,
        },
      });
    } else if (e instanceof mongoose.mongo.MongoError && e.code === 11000) {
      res.status(409).json({
        error: {
          code: 409,
          message: 'Duplicate user email or username (User already exist)',
        },
      });
    } else {
      res.status(500).json({
        error: {
          code: 500,
          message: 'Unknown error',
        },
      });
      console.error(e);
    }
  }
});

route.post('/delete/:user_id', required_auth(2), async (req, res) => {
  const user_id = req.params?.user_id;
  if (user_id === req.auth.user?.id) {
    res.status(400).json({
      code: 400,
      message: 'Invalid request (Cannot delete the current user)',
    });
    return;
  }
  try {
    const target_user = await User.findOne({ id: user_id });
    if (!target_user) {
      res.status(404).json({
        error: {
          code: 404,
          message: 'User ID does not exist',
        },
      });
      return;
    }
    if (
      req.auth.privilege_level! < 3 && // Require admin
      (target_user.role?.includes('admin') || target_user.role?.includes('teacher'))
    ) {
      res.status(403).json({
        error: {
          code: 403,
          message: 'Permission denied (Remove an admin or a teacher without admin right)',
        },
      });
      return;
    }
    await User.deleteOne({ id: user_id });
    res.json({});
  } catch (e) {
    if (e instanceof mongoose.Error.ValidationError) {
      const err = e;
      res.status(400).json(err.errors);
    } else if (e instanceof mongoose.mongo.MongoError) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Unable to remove the specific user',
        },
      });
    }
  }
});

route.post('/update/:user_id?', required_auth(), json(), async (req, res) => {
  const allowed_fields = ['username', 'linked_email', 'fullname', 'status'];
  let user_id = req.params?.user_id;
  if (user_id && req.auth.privilege_level! < 3) {
    res.status(403).json({
      error: {
        code: 403,
        message: 'Permission denied (Require admin role)',
      },
    });
    return;
  }
  if (!user_id) user_id = req.auth.user!.id;
  const update_fields = req.body;
  if (!update_fields) {
    res.status(400).json({
      error: {
        code: 400,
        message: 'Invalid data (Request body cannot be empty)',
      },
    });
    return;
  }
  try {
    // Validate update data fields
    if (!Object.keys(update_fields).every((key) => allowed_fields.includes(key))) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Invalid data (Invalid data fields)',
          allowed_fields,
        },
      });
      return;
    }
    await User.updateOne({ id: user_id }, update_fields);
    res.json({
      update: update_fields,
    });
  } catch (e) {
    if (e instanceof mongoose.Error.ValidationError) {
      const errors = Object.fromEntries(
        Object.entries(e.errors as Record<string, mongoose.Error.ValidatorError>).map(([key, value]) => [
          key,
          value.message,
        ])
      );
      res.status(400).json({
        error: {
          code: 400,
          errors,
        },
      });
    } else if (e instanceof mongoose.mongo.MongoError) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Unable to remove the specific user',
        },
      });
    } else {
      res.status(500).json({
        error: {
          code: 500,
          message: 'Unknown error',
        },
      });
      console.error(e);
    }
  }
});

export default route;
