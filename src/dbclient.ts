import db from 'mongoose';
import config from './config';

const RETRY_LIMIT = 10;

async function connect() {
  for (let i = 0; i < RETRY_LIMIT; i++) {
    try {
      await db.connect(config.CONNECTION_STR, {
        authSource: 'admin',
        serverSelectionTimeoutMS: 10000,
      });
      break;
    } catch (e) {
      if (i >= RETRY_LIMIT) {
        throw e;
      }
      console.error(`Failed #${i} Unable to establish connection to the database!`);
      if (e instanceof db.Error.MongooseServerSelectionError) {
        console.error(`Failed #${i} ${e.message}`);
      }
    }
  }
  console.log('Successfully connected to the database!');
}

connect().catch(console.dir);

export default db;
