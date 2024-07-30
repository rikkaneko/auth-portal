import { Router, json } from 'express';
import { Group, IGroup, User } from './models/schema';
import mongoose from 'mongoose';
import { do_auth, required_auth } from './util';

const route = Router();

const hidden_group_field = {
  _id: 0,
};

route.use(do_auth);

route.post('/create', required_auth(2), json(), async (req, res) => {
  const allowed_fields = ['id', 'name', 'organization', 'meta'];
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

export default route;
