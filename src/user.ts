import { Router, json } from 'express';
import { User, IUser, IUser$GroupWithRoles, Group } from './models/schema';
import mongoose from 'mongoose';
import { do_auth, required_auth } from './util';
import { email_validator } from './util';

const route = Router();

const hidden_user_field = {
  _id: 0,
  refresh_tokens: 0,
};

route.use(do_auth);

route.get('/me', required_auth(), async (req, res) => {
  try {
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
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoError) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Unable to fetch user profile',
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

route.get('/groups', required_auth(), async (req, res) => {
  try {
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
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoError) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Unable to fetch user profile',
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

route.post('/join_group', required_auth(2), json(), async (req, res) => {
  try {
    const allowed_fields = ['group_name', 'role'];
    const join_group: IUser$GroupWithRoles & { user_id: string } = req.body;
    // Validate update data fields
    if (!Object.keys(join_group).every((key) => allowed_fields.includes(key))) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Invalid data (Invalid data fields)',
          allowed_fields,
        },
      });
      return;
    }
    if (typeof join_group?.name !== 'string') {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Bad Request',
        },
      });
      return;
    }
    if ((await Group.findOne({ id: join_group.name })) === null) {
      res.status(404).json({
        error: {
          code: 404,
          message: 'Requested Group ID does not exist',
        },
      });
      return;
    }
    const result = await User.updateOne(
      { id: join_group?.user_id },
      {
        $push: {
          groups: {
            name: join_group?.name,
            role: join_group?.role,
          },
        },
      }
    );
    if (result.modifiedCount !== 1) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Unable to add user to the group',
        },
      });
      return;
    }
    res.json({
      join_group,
    });
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoError) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Unable to modify user group',
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

route.get('/list/:user_id?', required_auth(2), async (req, res) => {
  const result = await User.find(
    req.params.user_id ? { id: req.params.user_id } : {},
    req.params.user_id ? { ...hidden_user_field } : { ...hidden_user_field, groups: 0 }
  );
  if (req.params.user_id && result.length <= 0) {
    res.status(404).json({
      error: {
        code: 404,
        message: 'User does not exist',
      },
    });
    return;
  }
  res.json(req.params.user_id ? result[0] : result);
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
    await User.updateOne({ id: user_id }, { ...update_fields, updated_by: req.auth.user!.id });
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
