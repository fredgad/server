// app/controllers/hooks.controller.js
import fs from 'fs';
import { promises as fsp } from 'fs';
import mongoose, { Types } from 'mongoose';

import User from '../models/user.model.js'; // default export users
import StreamModel from '../models/stream.model.js'; // твой LiveStream

export const onPublish = async (req, res) => {
  try {
    const { secret, name: streamKey } = req.query;
    if (!secret || secret !== process.env.STREAM_WEBHOOK_SECRET) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    if (!streamKey)
      return res.status(400).json({ ok: false, error: 'name required' });

    const stream = await StreamModel.findOne({ streamKey });
    if (!stream)
      return res.status(404).json({ ok: false, error: 'Stream not found' });

    if (!stream.isLive) {
      stream.isLive = true;
      await stream.save();
    }

    const currentUser = await User.findById(stream.userId);
    if (currentUser) {
      const trustedIds = currentUser.trustedPeople.map(t => t.keyId);
      if (trustedIds.length) {
        const trustedUsers = await User.find({ keyId: { $in: trustedIds } });
        const notif = {
          type: 'stream_start',
          text: `${currentUser.username} начал прямую трансляцию`,
          streamId: stream._id,
          fromUser: currentUser.username,
          createdAt: new Date(),
          isRead: false,
        };
        await Promise.all(
          trustedUsers.map(u => {
            u.notifications.unshift(notif);
            return u.save();
          })
        );
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('[hooks/on_publish]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};

export const onDone = async (req, res) => {
  try {
    const { secret, name: streamKey, path } = req.query;
    if (!secret || secret !== process.env.STREAM_WEBHOOK_SECRET)
      return res.status(403).json({ ok: false, error: 'forbidden' });
    if (!streamKey || !path)
      return res.status(400).json({ ok: false, error: 'name/path required' });
    if (!fs.existsSync(path))
      return res.status(404).json({ ok: false, error: 'file not found' });

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

    // Обновить стрим
    stream.isLive = false;
    stream.vodUrl = vodUrl;
    await stream.save();

    // Привязать к пользователю
    await User.updateOne(
      { _id: new Types.ObjectId(stream.userId) },
      { $push: { videos: { url: vodUrl, createdAt: new Date() } } }
    );

    await fsp.unlink(path).catch(() => {});
    return res.json({ ok: true, vodUrl, gridfsId: String(uploadStream.id) });
  } catch (e) {
    console.error('[hooks/on_done]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
};
