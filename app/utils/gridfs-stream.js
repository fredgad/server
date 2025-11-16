import mongoose from 'mongoose';
import { gridfsBucket } from '../config/db.js';

const buildRange = (rangeHeader, size) => {
  if (!rangeHeader) return null;
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) return null;

  let start = match[1] ? parseInt(match[1], 10) : 0;
  let end = match[2] ? parseInt(match[2], 10) : size - 1;

  if (Number.isNaN(start) || start < 0) start = 0;
  if (Number.isNaN(end) || end >= size) end = size - 1;
  if (start > end) start = 0;

  return { start, end };
};

export const streamGridFsFile = async (req, res, filename) => {
  const db = mongoose.connection.db;
  const file = await db.collection('uploads.files').findOne({ filename });
  if (!file) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  const size = file.length;
  const mime = file.contentType || 'video/mp4';

  res.set('Accept-Ranges', 'bytes');
  res.set('Content-Type', mime);

  const range = buildRange(req.headers.range, size);

  if (!range) {
    res.set('Content-Length', String(size));
    const dl = gridfsBucket.openDownloadStreamByName(filename);
    dl.on('error', () => res.sendStatus(404));
    dl.pipe(res);
    return;
  }

  const { start, end } = range;
  const chunkLen = end - start + 1;

  res.status(206).set({
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': String(chunkLen),
    'Cache-Control': 'no-cache',
  });

  const dl = gridfsBucket.openDownloadStreamByName(filename, {
    start,
    end: end + 1,
  });
  dl.on('error', () => res.sendStatus(404));
  dl.pipe(res);
};
