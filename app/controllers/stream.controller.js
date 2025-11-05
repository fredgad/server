import LiveStream from '../models/stream.model.js';
import User from '../models/user.model.js';

export const startStream = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    const user = await User.findById(userId).lean();
    if (!user?.keyId) return res.status(400).json({ error: 'keyId missing' });

    const title = req.body.title || 'Live';
    const streamKey = user.keyId; // ← ключ стрима = keyId

    // создадим/обновим запись стрима
    const stream = await LiveStream.findOneAndUpdate(
      { streamKey },
      { $set: { userId, title, isLive: false } },
      { new: true, upsert: true }
    );

    const rawHost =
      process.env.MEDIA_HOST ||
      (req.headers['x-forwarded-host'] || '').split(',')[0] ||
      (req.headers.host || '').split(':')[0] ||
      '127.0.0.1';

    const publishRtmp = `rtmp://${rawHost}:1935/live/${streamKey}`;

    return res.json({
      ok: true,
      streamId: stream._id,
      streamKey,
      publish: { rtmp: publishRtmp },
    });
  } catch (e) {
    console.error('[startStream] error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
