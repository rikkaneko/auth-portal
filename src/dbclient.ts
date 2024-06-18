import mongoose from 'mongoose';
import config from './config';

async function connect() {
  try {
    await mongoose.connect(config.CONNECTION_STR, {
      authSource: 'admin',
      socketTimeoutMS: 2000,
      serverSelectionTimeoutMS: 2000,
    });
    console.log('Successfully connected to the database!');
  } catch (err) {
    console.error('Unable to establish connection to the database!');
    process.exit(1);
  }
}

connect().catch(console.dir);

export default mongoose;
