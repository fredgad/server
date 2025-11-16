// app/controllers/hooks.controller.js
import fs from 'fs';
import { promises as fsp } from 'fs';
import mongoose, { Types } from 'mongoose';
import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe-static';

import User from '../models/user.model.js';
import StreamModel from '../models/stream.model.js';

// === ffprobe path ===
ffmpeg.setFfprobePath(ffprobe.path);

// === in-memory dedup set (reset after few minutes) ===
const seenFiles = new Set();
const DEDUP_TTL_MS = 5 * 60 * 1000;

// === helpers ===
const ts = () => new Date().toISOString();

async function waitForStableFile(
  fullPath,
  { timeoutMs = 15000, intervalMs = 300 } = {}
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
    } catch {
      // файл ещё не создан — ждём
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

function parseNum(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// === on_publish: трансляция началась ===
export const onPublish = async (req, res) => {
  try {
    const { secret } = req.query;
    const streamKey = req.body?.name || req.query?.name;

    if (!secret || secret !== process.env.STREAM_WEBHOOK_SECRET) {
      console.warn(`[on_publish] ${ts()} forbidden: bad secret`);
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    if (!streamKey) {
      console.warn(`[on_publish] ${ts()} missing streamKey (name)`);
      return res.status(400).json({ ok: false, error: 'name required' });
    }

    const user = await User.findOne({ keyId: streamKey });
    if (!user) {
      console.warn(`[on_publish] ${ts()} user not found for key=${streamKey}`);
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
    console.error('[on_publish] error:', e);
    // возвращаем 200 чтобы nginx-rtmp не рвал соединение
    return res.status(200).json({ ok: true });
  }
};

// === on_done/on_record_done: запись файла завершена ===
export const onDone = async (req, res) => {
  const t0 = Date.now();

  try {
    // 1) базовые параметры
    const { secret } = req.query;
    const call = req.body?.call || req.query?.call; // 'record_done' и т.д.
    const streamKey = req.body?.name || req.query?.name;
    const ngPath = req.body?.path; // присылается nginx-rtmp
    const inFilename = req.body?.filename; // исходное имя (обычно .flv)
    const clientInfo = {
      addr: req.body?.addr,
      clientid: req.body?.clientid,
      bytes_in: parseNum(req.body?.bytes_in),
      bytes_out: parseNum(req.body?.bytes_out),
      session_time: parseNum(req.body?.session_time),
    };

    console.log(`[on_done] ${ts()} <- ${req.method} call=${call}`, {
      query: req.query,
      body: {
        name: streamKey,
        path: ngPath,
        filename: inFilename,
        ...clientInfo,
      },
    });

    // 2) защита
    if (!secret || secret !== process.env.STREAM_WEBHOOK_SECRET) {
      console.warn(`[on_done] ${ts()} forbidden: bad secret`);
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    if (!streamKey) {
      console.warn(`[on_done] ${ts()} missing streamKey (name)`);
      return res.status(400).json({ ok: false, error: 'name required' });
    }

    // 3) путь к исходнику (.flv) — при record_suffix .flv
    const flvPath = ngPath || `/var/streams/${streamKey}.flv`;
    console.log(`[on_done] ${ts()} flvPath=${flvPath}`);

    // 4) ждём стабилизацию файла
    const ready = await waitForStableFile(flvPath, {
      timeoutMs: 15000,
      intervalMs: 300,
    });
    if (!ready) {
      console.warn(`[on_done] ${ts()} file not ready: ${flvPath}`);
      return res
        .status(404)
        .json({ ok: false, error: 'file not ready', path: flvPath });
    }

    // 5) быстрый фильтр по размеру (мусорные коротыши)
    const st = await fsp.stat(flvPath);
    console.log(
      `[on_done] ${ts()} flv size=${st.size}B ino=${st.ino} mtimeMs=${
        st.mtimeMs
      }`
    );
    const MIN_SIZE = 200 * 1024; // 200KB
    if (st.size < MIN_SIZE) {
      console.warn(
        `[on_done] ${ts()} skip: too small (${st.size}B < ${MIN_SIZE})`
      );
      return res.json({ ok: true, skipped: true, reason: 'too small' });
    }

    // 6) дедуп: тот же файл уже обрабатывали
    const dedupKey = `${flvPath}:${st.ino}:${Math.trunc(st.mtimeMs)}`;
    if (seenFiles.has(dedupKey)) {
      console.warn(`[on_done] ${ts()} skip: duplicate dedupKey=${dedupKey}`);
      return res.json({ ok: true, skipped: true, reason: 'duplicate' });
    }
    seenFiles.add(dedupKey);
    setTimeout(() => seenFiles.delete(dedupKey), DEDUP_TTL_MS);

    // 7) ремакс FLV -> MP4 без перекодирования
    const mp4Filename = `${streamKey}-${Date.now()}.mp4`;
    const outMp4 = `/var/streams/${mp4Filename}`;

    await new Promise((resolve, reject) => {
      ffmpeg(flvPath)
        .outputOptions(['-c copy', '-movflags +faststart'])
        .on('start', cmd => console.log(`[on_done] ${ts()} ffmpeg: ${cmd}`))
        .on('error', err => reject(err))
        .on('end', resolve)
        .save(outMp4);
    });
    console.log(`[on_done] ${ts()} remuxed -> ${outMp4}`);

    // 8) длительность MP4
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
      console.log(`[on_done] ${ts()} probed duration=${duration}`);
    } catch (e) {
      console.warn(`[on_done] ${ts()} ffprobe failed: ${e?.message}`);
    }

    // минимальная длительность
    const MIN_DUR = 2.0; // сек
    if (duration < MIN_DUR) {
      console.warn(
        `[on_done] ${ts()} skip: duration ${duration}s < ${MIN_DUR}s`
      );
      return res.json({
        ok: true,
        skipped: true,
        reason: 'short duration',
        duration,
      });
    }

    // 9) находим Stream
    const stream = await StreamModel.findOne({ streamKey });
    if (!stream) {
      console.warn(`[on_done] ${ts()} Stream not found for key=${streamKey}`);
      return res.status(404).json({ ok: false, error: 'Stream not found' });
    }

    // 10) загрузка в GridFS
    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'uploads',
    });
    const gridName = mp4Filename; // сохраняем то же имя
    const vodUrl = `/uploads/${gridName}`;

    const uploadStream = bucket.openUploadStream(gridName, {
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

    // 11) обновляем БД
    stream.isLive = false;
    stream.vodUrl = vodUrl;
    await stream.save();

    await User.updateOne(
      { _id: new Types.ObjectId(stream.userId) },
      { $push: { videos: { url: vodUrl, createdAt: new Date(), duration } } }
    );

    // 12) чистим локальный MP4
    await fsp.unlink(outMp4).catch(() => {});
    // при желании можно также удалять .flv:
    // await fsp.unlink(flvPath).catch(() => {});

    const ms = Date.now() - t0;
    console.log('[on_done] uploaded to GridFS', {
      streamKey,
      vodUrl,
      gridfsId: String(uploadStream.id),
      duration,
      ms,
    });

    return res.json({
      ok: true,
      vodUrl,
      gridfsId: String(uploadStream.id),
      duration,
      ms,
    });
  } catch (e) {
    console.error('[on_done] error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
