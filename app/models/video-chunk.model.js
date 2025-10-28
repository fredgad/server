import mongoose from 'mongoose';

const videoChunkSchema = new mongoose.Schema({
  streamId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'LiveStream' },
  chunkNumber: { type: Number, required: true },
  filename: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('VideoChunk', videoChunkSchema);
