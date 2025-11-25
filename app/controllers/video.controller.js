import { gridfsBucket, gfs } from '../config/db.js';
import userModel from '../models/user.model.js';
import { toPublicUrl } from '../utils/public-url.js';
import { streamGridFsFile } from '../utils/gridfs-stream.js';

const extractFilename = url => {
  if (!url) return null;
  const idx = String(url).lastIndexOf('/uploads/');
  if (idx === -1) return null;
  return url.slice(idx + '/uploads/'.length);
};

const serializeVideos = (videos = [], req) =>
  videos.map(videoDoc => {
    const video =
      typeof videoDoc?.toObject === 'function'
        ? videoDoc.toObject()
        : { ...videoDoc };
    return {
      ...video,
      url: toPublicUrl(req, video.url),
    };
  });

// ======== Получить видео пользователя ========
export const getUserVideos = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ videos: serializeVideos(user.videos || [], req) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ======== Просмотр видео (stream GridFS) ========
export const getVideoFile = async (req, res) => {
  try {
    await streamGridFsFile(req, res, req.params.filename);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

// ======== Удалить видео ========
export const deleteUserVideo = async (req, res) => {
  try {
    const { url, createdAt } = req.body;
    const user = await userModel.findById(req.user.userId);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const filename = extractFilename(url);
    if (!filename)
      return res.status(400).json({ error: 'Invalid video URL' });

    const createdAtMs = createdAt ? new Date(createdAt).getTime() : null;
    const normalizedUrl = `/uploads/${filename}`;

    const file = await gfs.files.findOne({ filename }).catch(() => null);
    if (file) {
      await gridfsBucket.delete(file._id);
    }

    const videos = user.videos || [];
    const byDateMatch = videos.find(v => {
      const sameFile =
        extractFilename(v.url) === filename ||
        v.url === normalizedUrl ||
        v.url === url;
      if (!sameFile) return false;
      if (!createdAtMs) return true;
      const videoCreatedAt = new Date(v.createdAt).getTime();
      return Number.isFinite(videoCreatedAt)
        ? videoCreatedAt === createdAtMs
        : true;
    });

    const videoToRemove =
      byDateMatch ||
      videos.find(
        v =>
          extractFilename(v.url) === filename ||
          v.url === normalizedUrl ||
          v.url === url
      );

    if (!videoToRemove) {
      return res.status(404).json({ error: 'Video not found for user' });
    }

    await userModel.updateOne(
      { _id: user._id },
      { $pull: { videos: { _id: videoToRemove._id } } }
    );

    res.json({ message: 'Video deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
