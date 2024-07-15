import { Router, json } from 'express';
import { User, IUser } from './models/schema';
import mongoose from 'mongoose';
import { do_auth, required_auth } from './util';
import { email_validator } from './util';

const route = Router();

const hidden_user_field = {
  _id: 0,
  groups: 0,
  refresh_tokens: 0,
};

route.use(do_auth);

route.get('/me', required_auth(), async (req, res) => {
  const result = await User.findOne({ id: req.auth.user?.id }, { ...hidden_user_field });
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
  const result = await User.findOne(
    { id: req.auth.user?.id },
    {
      'groups.name': 1,
      'groups.role': 1,
    }
  );
  if (result === null) {
    res.status(404).json({
      error: {
        code: 404,
        message: 'Current user information is not available',
      },
    });
    return;
  }
  res.json(
    result.groups.map((v) => {
      if (v.role && v.role.length > 0) {
        return v;
      } else return v.name;
    })
  );
});

route.get('/list/:user_id?', required_auth(2), async (req, res) => {
  const result = await User.find(req.params.user_id ? { id: req.params.user_id } : {}, { ...hidden_user_field });
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

route.post('/create', required_auth(2), json(), async (req, res) => {
  const allowed_fields = ['role', 'username', 'linked_email', 'fullname', 'status', 'organization'];
  const new_user_info: IUser = req.body;
  if (req.auth.privilege_level! < 3) {
    // Require admin role
    if (new_user_info?.role?.includes('admin') || new_user_info?.role?.includes('teacher'))
      res.status(403).json({
        error: {
          code: 403,
          message: 'Permission denied (Assign a new admin role without admin right)',
        },
      });
    return;
  }

  const email = email_validator.exec(new_user_info?.linked_email);
  if (!email || email.length !== 3) {
    res.status(400).json({
      error: {
        code: 400,
        message: 'Invalid data (Invalid email format)',
      },
    });
    return;
  }
  const username = new_user_info?.username ?? email[0];
  const full_user_id = new_user_info?.organization ? `${new_user_info.organization}::${username}` : username;
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
      id: full_user_id,
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
    if (req.auth.privilege_level! < 3) {
      // Require admin
      if (target_user.role?.includes('admin') || target_user.role?.includes('teacher'))
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
    if (e instanceof mongoose.mongo.MongoError) {
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
  const allowed_fields = ['role', 'username', 'fullname', 'status'];
  let user_id = req.params?.user_id;
  const update_fields: IUser = req.body;
  // Only admin role can update others' sensitive fields
  if (req.auth.privilege_level! < 3) {
    if (user_id || !!update_fields?.role || !!update_fields?.status)
      res.status(403).json({
        error: {
          code: 403,
          message: 'Permission denied (Require admin role)',
        },
      });
    return;
  }
  if (!user_id) user_id = req.auth.user!.id;
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
          message: 'Unable to update user profile',
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
