// import mongoose from 'mongoose';

// const liveStreamSchema = new mongoose.Schema({
//   userId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'users',
//     required: true,
//   },
//   streamKey: { type: String, required: true, unique: true }, // == nginx $name
//   title: { type: String, default: 'Live Stream' },
//   isLive: { type: Boolean, default: false },
//   vodUrl: { type: String }, // заполним в on_done
//   createdAt: { type: Date, default: Date.now },
// });

// liveStreamSchema.index({ streamKey: 1 }, { unique: true });

// export default mongoose.model('LiveStream', liveStreamSchema);

// app/models/stream.model.js
import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true,
  },
  streamKey: { type: String, required: true, unique: true }, // ← это то, что в nginx $name
  title: { type: String, default: 'Live Stream' },
  isLive: { type: Boolean, default: false },
  vodUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ streamKey: 1 }, { unique: true });

export default mongoose.model('LiveStream', schema);
