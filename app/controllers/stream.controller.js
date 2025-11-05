import crypto from 'crypto';
import LiveStream from '../models/stream.model.js';

export const startStream = async (req, res) => {
  try {
    // authenticateToken должен быть подключён до этого роутера:
    // router.post('/start', authenticateToken, startStream)
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const title = req.body.title || 'Live';

    // streamKey — уникальный ключ для RTMP
    const streamKey = crypto.randomBytes(8).toString('hex');

    const stream = await LiveStream.create({
      userId,
      title,
      streamKey,
      isLive: false,
    });

    // === Определяем надёжно адрес сервера (MEDIA_HOST из .env или фактический хост) ===
    const rawHost =
      process.env.MEDIA_HOST ||
      (req.headers['x-forwarded-host'] || '').split(',')[0] ||
      (req.headers.host || '').split(':')[0] ||
      '127.0.0.1';

    const publishRtmp = `rtmp://${rawHost}:1935/live/${streamKey}`;

    // Возвращаем клиенту данные о стриме
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
