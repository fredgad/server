import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true,
  },

  streamKey: { type: String, required: true }, // ← это то, что в nginx $name
  title: { type: String, default: 'Live Stream' },
  isLive: { type: Boolean, default: false },
  startedAt: { type: Date, default: Date.now },
  vodUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ streamKey: 1 }, { unique: true });

export default mongoose.model('LiveStream', schema);
