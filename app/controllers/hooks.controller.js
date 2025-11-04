import fs from 'fs';
import { promises as fsp } from 'fs';
import mongoose, { Types } from 'mongoose';

import User from '../models/user.model.js'; // default export users
import StreamModel from '../models/stream.model.js'; // LiveStream

export const onPublish = async (req, res) => {
  try {
    const { secret } = req.query;
    // name теперь приходит в теле (application/x-www-form-urlencoded) от nginx-rtmp
    const streamKey = req.body?.name || req.query?.name;

    if (!secret || secret !== process.env.STREAM_WEBHOOK_SECRET) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    if (!streamKey)
      return res.status(400).json({ ok: false, error: 'name required' });

    const user = await User.findOne({ keyId: streamKey });
    if (!user) {
      console.warn('[hooks/on_publish] user not found for key:', streamKey);
      return res.json({ ok: true, note: 'user not found; publish allowed' });
    }

    const stream = await StreamModel.findOneAndUpdate(
      { streamKey },
      {
        $setOnInsert: { userId: user._id, streamKey, createdAt: new Date() },
        $set: { isLive: true },
      },
      { upsert: true, new: true }
    );

    console.log('[on_publish] ok:', { streamKey, userId: String(user._id) });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[hooks/on_publish] Error:', e);
    return res.status(200).json({ ok: true });
  }
};

export const onDone = async (req, res) => {
  try {
    const { secret } = req.query;
    const streamKey = req.body?.name || req.query?.name; // <- ключ из тела POST
    if (!secret || secret !== process.env.STREAM_WEBHOOK_SECRET)
      return res.status(403).json({ ok: false, error: 'forbidden' });
    if (!streamKey)
      return res.status(400).json({ ok: false, error: 'name required' });

    // путь формируем на стороне сервера (не доверяем query)
    const path = `/var/streams/${streamKey}.mp4`;
    if (!fs.existsSync(path))
      return res.status(404).json({ ok: false, error: 'file not found', path });

    const stream = await StreamModel.findOne({ streamKey });
    if (!stream)
      return res.status(404).json({ ok: false, error: 'Stream not found' });

    // GridFS
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'uploads',
    });
    const filename = `${streamKey}-${Date.now()}.mp4`;
    const vodUrl = `/uploads/${filename}`;

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: 'video/mp4',
      metadata: { streamKey },
    });
    await new Promise((resolve, reject) => {
      fs.createReadStream(path)
        .on('error', reject)
        .pipe(uploadStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    stream.isLive = false;
    stream.vodUrl = vodUrl;
    await stream.save();

    await User.updateOne(
      { _id: new Types.ObjectId(stream.userId) },
      { $push: { videos: { url: vodUrl, createdAt: new Date() } } }
    );

    await fsp.unlink(path).catch(() => {});
    console.log('[on_done] uploaded to GridFS', {
      streamKey,
      vodUrl,
      gridfsId: String(uploadStream.id),
    });
    return res.json({ ok: true, vodUrl, gridfsId: String(uploadStream.id) });
  } catch (e) {
    console.error('[hooks/on_done]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};
