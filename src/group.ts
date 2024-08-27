import { Router, json } from 'express';
import { Group, IGroup, User } from './models/schema';
import mongoose from 'mongoose';
import { do_auth, required_auth, email_validator } from './util';
import { ImportGroupInput } from './types';

const route = Router();

const hidden_group_field = {
  _id: 0,
};

route.use(do_auth);

route.post('/create', required_auth(2), json(), async (req, res) => {
  const allowed_fields = ['id', 'name', 'organization', 'meta', 'type'];
  const new_group_info: IGroup = req.body;
  try {
    // Validate update data fields
    if (!Object.keys(new_group_info).every((key) => allowed_fields.includes(key))) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Invalid data (Invalid data fields)',
          allowed_fields,
        },
      });
      return;
    }
    const result = await Group.create({
      ...new_group_info,
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
          message: 'Field validation error',
          fields: errors,
        },
      });
    } else if (e instanceof mongoose.mongo.MongoError && e.code === 11000) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Duplicate group ID (Group ID already used)',
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

route.post('/update/:group_id', required_auth(2), json(), async (req, res) => {
  const allowed_fields = ['name', 'type', 'meta'];
  const update_fields: IGroup = req.body;
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
    await Group.updateOne(
      { id: req.params.group_id },
      {
        ...update_fields,
        updated_by: req.auth.user!.id,
      }
    );
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
          message: 'Field validation error',
          fields: errors,
        },
      });
    } else if (e instanceof mongoose.mongo.MongoError && e.code === 11000) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Duplicate group ID (Group ID already used)',
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

route.post('/delete/:group_id', required_auth(2), async (req, res) => {
  const group_id = req.params.group_id;
  try {
    const target_user = await Group.findOne({ id: group_id });
    if (!target_user) {
      res.status(404).json({
        error: {
          code: 404,
          message: 'Group ID does not exist',
        },
      });
      return;
    }
    await Group.deleteOne({ id: group_id });
    await User.updateMany({}, { $pull: { groups: { id: group_id } } });
    res.json({});
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoError) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Unable to remove the specific group',
        },
      });
    }
  }
});

route.get('/list/:group_id?', required_auth(), async (req, res) => {
  try {
    const result = await Group.find(
      req.params.group_id ? { id: req.params.group_id } : {},
      req.params.group_id ? { ...hidden_group_field } : { ...hidden_group_field, groups: 0 }
    );
    if (req.params.group_id && result.length <= 0) {
      res.status(404).json({
        error: {
          code: 404,
          message: 'Group ID does not exist',
        },
      });
      return;
    }
    res.json(req.params.group_id ? result[0] : result);
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoError) {
      res.status(400).json({
        error: {
          code: 400,
          message: e.message,
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

route.get('/list_members/:group_id', required_auth(), async (req, res) => {
  try {
    const group_id = req.params.group_id;
    const result = await User.find({ groups: { $elemMatch: { id: group_id } } }, { id: 1, 'groups.$': 1 });
    res.json(
      result.map((user) => {
        return {
          user_id: user.id,
          role: user.groups[0].role,
        };
      })
    );
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoError) {
      res.status(400).json({
        error: {
          code: 400,
          message: e.message,
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

route.post('/import_members/:group_id', required_auth(2), json(), async (req, res) => {
  const group_id = req.params.group_id;
  const import_list: ImportGroupInput = req.body;
  let success_count = 0;
  const error_entries = new Map<string, string>();

  try {
    const result = await Group.findOne({ id: group_id });
    if (!result) {
      res.status(404).json({
        error: {
          code: 404,
          message: 'Group ID does not exist',
        },
      });
      return;
    }
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoError) {
      res.status(400).json({
        error: {
          code: 400,
          message: e.message,
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

  if (!import_list?.members || !import_list?.default?.user_role || !import_list?.default?.group_role) {
    res.status(400).json({
      error: {
        code: 400,
        message: 'Bad Request',
      },
    });
    return;
  }

  // Require admin role
  if (import_list.default.user_role.includes('admin')) {
    res.status(400).json({
      error: {
        code: 400,
        message: 'Permission denied (Default assign a new admin role without admin right)',
      },
    });
    return;
  }

  for (const [idx, user] of import_list.members.entries()) {
    if (!user.linked_email) {
      error_entries.set(`Entry #${idx}`, 'Field linked_email is required');
      continue;
    }

    const email = email_validator.exec(user.linked_email);
    if (!email || email.length !== 3) {
      error_entries.set(user.linked_email, 'Invalid email format');
      continue;
    }

    try {
      const existing_user = await User.findOne({ linked_email: user.linked_email });
      if (!existing_user) {
        // Require admin role
        if (user.user_role?.includes('admin')) {
          error_entries.set(user.linked_email, 'Permission denied (Assign a new admin role without admin right)');
          continue;
        }
        // Create new user with preassigned role
        await User.create({
          id: user.linked_email,
          linked_email: user.linked_email,
          username: user.linked_email,
          fullname: user.fullname,
          role: user.user_role ?? import_list.default.user_role,
          groups: [
            {
              id: group_id,
              role: user.group_role ?? import_list.default.group_role,
            },
          ],
          created_by: req.auth.user!.id,
          updated_by: req.auth.user!.id,
        });
      } else {
        const existing_group = await User.findOne({ id: existing_user.id, 'groups.id': group_id });
        if (existing_group) {
          // Update group role for exisiting group members
          await User.updateOne(
            { id: existing_user.id, 'groups.id': group_id },
            {
              $set: {
                'groups.$.role': user?.group_role ?? import_list.default.group_role,
                updated_by: req.auth.user!.id,
              },
            }
          );
        } else {
          // Add user to the group
          await User.updateOne(
            { id: existing_user.id },
            {
              $push: {
                groups: {
                  id: group_id,
                  role: user?.group_role ?? import_list.default.group_role,
                },
              },
              $set: { updated_by: req.auth.user!.id },
            }
          );
        }
      }
      success_count += 1;
    } catch (e) {
      if (e instanceof mongoose.Error.ValidationError) {
        error_entries.set(user.linked_email, 'Field validation error');
      } else if (e instanceof mongoose.mongo.MongoError) {
        error_entries.set(user.linked_email, e.message);
      } else {
        error_entries.set(user.linked_email, 'Unknown error');
        console.error(e);
      }
    }
  }

  if (error_entries.size > 0) {
    res.json({
      success_count,
      failed_count: error_entries.size,
      failed_entries: Array.from(error_entries, ([user, message]) => ({ user, message })),
    });
  } else {
    res.json({
      success_count,
    });
  }
});

export default route;
