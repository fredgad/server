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

// === Хук: завершение трансляции (FLV -> MP4 -> GridFS) ===
export const onDone = async (req, res) => {
  const t0 = Date.now();
  try {
    // 1) Безопасность и входные данные
    const { secret } = req.query;
    const streamKey = req.body?.name || req.query?.name; // nginx-rtmp шлёт name=<key>
    if (!secret || secret !== process.env.STREAM_WEBHOOK_SECRET) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    if (!streamKey) {
      return res.status(400).json({ ok: false, error: 'name required' });
    }

    // nginx-rtmp передаёт полный путь к .flv
    const flvPath = req.body?.path || `/var/streams/${streamKey}.flv`;
    const outMp4 = `/var/streams/${streamKey}-${Date.now()}.mp4`;

    // 2) Ждём, пока .flv «устаканится» (не растёт размер)
    const ready = await waitForStableFile(flvPath, {
      timeoutMs: 15_000,
      intervalMs: 300,
    });
    if (!ready) {
      console.warn('[on_done] file not ready:', flvPath);
      return res
        .status(404)
        .json({ ok: false, error: 'file not ready', path: flvPath });
    }

    // 3) Remux FLV -> MP4 без перекодирования (быстро, -c copy)
    await new Promise((resolve, reject) => {
      ffmpeg(flvPath)
        .outputOptions(['-c copy', '-movflags +faststart'])
        .on('error', err =>
          reject(new Error('ffmpeg remux error: ' + err.message))
        )
        .on('end', resolve)
        .save(outMp4);
    });

    // 4) ffprobe: получаем длительность
    let duration = 0;
    try {
      const probe = await new Promise((resolve, reject) =>
        ffmpeg.ffprobe(outMp4, (err, data) =>
          err ? reject(err) : resolve(data)
        )
      );
      duration =
        probe?.format?.duration ??
        probe?.streams?.find(s => s.codec_type === 'video')?.duration ??
        0;
      if (typeof duration === 'string') duration = parseFloat(duration) || 0;
    } catch (e) {
      console.warn('[on_done] ffprobe failed:', e?.message);
    }

    // 5) Ищем Stream и валидируем
    const stream = await StreamModel.findOne({ streamKey });
    if (!stream) {
      console.warn('[on_done] Stream not found for key:', streamKey);
      return res.status(404).json({ ok: false, error: 'Stream not found' });
    }

    // 6) Загрузка MP4 в GridFS
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
      fs.createReadStream(outMp4)
        .on('error', reject)
        .pipe(uploadStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    // 7) Обновляем документы
    stream.isLive = false;
    stream.vodUrl = vodUrl;
    await stream.save();

    await User.updateOne(
      { _id: new Types.ObjectId(stream.userId) },
      { $push: { videos: { url: vodUrl, createdAt: new Date(), duration } } }
    );

    // 8) Уборка локальных файлов
    // MP4 удаляем всегда после успешной загрузки.
    await fsp.unlink(outMp4).catch(() => {});
    // FLV оставляем, если длительность нулевая — пригодится для отладки; иначе можно чистить:
    if (duration > 0) await fsp.unlink(flvPath).catch(() => {});

    // 9) Лог и ответ
    console.log('[on_done] uploaded to GridFS', {
      streamKey,
      vodUrl,
      gridfsId: String(uploadStream.id),
      duration,
      ms: Date.now() - t0,
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
