import { gridfsBucket, gfs } from '../config/db.js';
import mongoose from 'mongoose';
import userModel from '../models/user.model.js';

// ======== Получить видео пользователя ========
export const getUserVideos = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId);
    res.json({ videos: user.videos || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ======== Просмотр видео (stream GridFS) ========
export const getVideoFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const file = await mongoose.connection.db
      .collection('uploads.files')
      .findOne({ filename });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const range = req.headers.range;
    const size = file.length;
    const mime = file.contentType || 'video/mp4';

    res.set('Accept-Ranges', 'bytes');
    res.set('Content-Type', mime);

    if (!range) {
      res.set('Content-Length', String(size));
      const dl = gridfsBucket.openDownloadStreamByName(filename);
      return dl.pipe(res);
    }

    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (start > end) start = 0;
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
    dl.pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ======== Удалить видео ========
export const deleteUserVideo = async (req, res) => {
  try {
    const { url, createdAt } = req.body;
    const user = await userModel.findById(req.user.userId);

    if (!url.includes('/uploads/'))
      return res.status(400).json({ error: 'Invalid video URL' });

    const filename = url.split('/uploads/')[1];
    const file = await gfs.files.findOne({ filename });
    if (!file) return res.status(404).json({ error: 'File not found' });
    await gridfsBucket.delete(file._id);

    user.videos = user.videos.filter(
      v =>
        !(
          v.url === url &&
          new Date(v.createdAt).getTime() === new Date(createdAt).getTime()
        )
    );
    await user.save();

    res.json({ message: 'Video deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
