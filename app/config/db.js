import mongoose from 'mongoose';
import grid from 'gridfs-stream';

let gridfsBucket;
let gfs;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads',
    });
    gfs = grid(mongoose.connection.db, mongoose.mongo);
    gfs.collection('uploads');
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB error', err);
    process.exit(1);
  }
};

export { gridfsBucket, gfs };
export default connectDB;
