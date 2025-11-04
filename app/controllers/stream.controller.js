// app/controllers/stream.controller.js
import crypto from 'crypto';
import LiveStream from '../models/stream.model.js';

export const startStream = async (req, res) => {
  try {
    // Убедись, что до этого стоит authenticateToken миддлварь:
    // router.post('/start', authenticateToken, startStream)
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const title = req.body.title || 'Live';
    // streamKey — внешний ключ, именно его шлёт nginx как $name
    const streamKey = crypto.randomBytes(8).toString('hex'); // короче и удобней

    const stream = await LiveStream.create({
      userId,
      title,
      streamKey,
      isLive: false,
    });

    const publishRtmp = `rtmp://${
      process.env.MEDIA_HOST || '127.0.0.1'
    }:1935/live/${streamKey}`;
    // live/live - to destroy confusion with nginx location /live/

    res.json({
      ok: true,
      streamId: stream._id,
      streamKey,
      publish: { rtmp: publishRtmp },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
