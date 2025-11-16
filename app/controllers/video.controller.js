import { gridfsBucket, gfs } from '../config/db.js';
import userModel from '../models/user.model.js';
import { toPublicUrl } from '../utils/public-url.js';
import { streamGridFsFile } from '../utils/gridfs-stream.js';

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
