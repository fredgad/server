import fs from 'fs';
import { promises as fsp } from 'fs';
import mongoose, { Types } from 'mongoose';
import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe-static';

import User from '../models/user.model.js';
import StreamModel from '../models/stream.model.js';

// === Настраиваем путь к ffprobe ===
ffmpeg.setFfprobePath(ffprobe.path);

// === Хук: начало трансляции ===
export const onPublish = async (req, res) => {
  try {
    const { secret } = req.query;
    const streamKey = req.body?.name || req.query?.name;

    if (!secret || secret !== process.env.STREAM_WEBHOOK_SECRET)
      return res.status(403).json({ ok: false, error: 'forbidden' });
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

// === Вспомогательная функция ожидания стабильного файла ===
async function waitForStableFile(
  fullPath,
  { timeoutMs = 10000, intervalMs = 250 } = {}
) {
  const start = Date.now();
  let lastSize = -1;
  while (Date.now() - start < timeoutMs) {
    try {
      const st = await fsp.stat(fullPath);
      if (st.size > 0) {
        if (st.size === lastSize) return true;
        lastSize = st.size;
      }
    } catch (_) {
      /* файл пока не появился */
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

// === Хук: завершение трансляции ===
export const onDone = async (req, res) => {
  try {
    const { secret } = req.query;
    const streamKey = req.body?.name || req.query?.name;

    if (!secret || secret !== process.env.STREAM_WEBHOOK_SECRET)
      return res.status(403).json({ ok: false, error: 'forbidden' });
    if (!streamKey)
      return res.status(400).json({ ok: false, error: 'name required' });

    const base = `/var/streams/${streamKey}.mp4`;
    const part = `${base}.part`;

    // ждём пока файл стабилизируется
    if (!fs.existsSync(base) && fs.existsSync(part)) {
      await waitForStableFile(part);
      try {
        await fsp.rename(part, base);
      } catch {}
    }

    const ready = await waitForStableFile(base);
    if (!ready) {
      return res
        .status(404)
        .json({ ok: false, error: 'file not ready', path: base });
    }

    const stream = await StreamModel.findOne({ streamKey });
    if (!stream)
      return res.status(404).json({ ok: false, error: 'Stream not found' });

    // === ffprobe: длительность видео ===
    let duration = 0;
    try {
      const probe = await new Promise((resolve, reject) =>
        ffmpeg.ffprobe(base, (err, data) => (err ? reject(err) : resolve(data)))
      );
      duration =
        probe?.format?.duration ??
        probe?.streams?.find(s => s.codec_type === 'video')?.duration ??
        0;
      if (typeof duration === 'string') duration = parseFloat(duration) || 0;
    } catch (e) {
      console.warn('[on_done] ffprobe failed:', e?.message);
    }

    // === Загружаем mp4 в GridFS ===
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'uploads',
    });
    const filename = `${streamKey}-${Date.now()}.mp4`;
    const vodUrl = `/uploads/${filename}`;

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: 'video/mp4',
      metadata: { streamKey, duration },
    });

    await new Promise((resolve, reject) => {
      fs.createReadStream(base)
        .on('error', reject)
        .pipe(uploadStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    // === Обновляем базу ===
    stream.isLive = false;
    stream.vodUrl = vodUrl;
    await stream.save();

    await User.updateOne(
      { _id: new Types.ObjectId(stream.userId) },
      { $push: { videos: { url: vodUrl, createdAt: new Date(), duration } } }
    );

    // === Удаляем локальный mp4, если всё ок ===
    if (duration > 0) {
      await fsp.unlink(base).catch(() => {});
    } else {
      console.warn('[on_done] keep local mp4 due to zero duration:', base);
    }

    console.log('[on_done] uploaded to GridFS', {
      streamKey,
      vodUrl,
      gridfsId: String(uploadStream.id),
      duration,
    });

    return res.json({
      ok: true,
      vodUrl,
      gridfsId: String(uploadStream.id),
      duration,
    });
  } catch (e) {
    console.error('[hooks/on_done]', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
