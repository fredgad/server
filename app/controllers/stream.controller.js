import LiveStream from '../models/stream.model.js';
import User from '../models/user.model.js';
import { sendFcm } from '../services/fcm.js';

const buildPlaybackUrl = (req, streamKey) => {
  const proto =
    process.env.PUBLIC_PROTO ||
    (req.headers['x-forwarded-proto'] || '').split(',')[0] ||
    'http';

  const hostSource =
    process.env.HLS_HOST ||
    process.env.MEDIA_HOST ||
    process.env.PUBLIC_HOST ||
    (req.headers['x-forwarded-host'] || '').split(',')[0] ||
    (req.headers.host || '').split(',')[0] ||
    '127.0.0.1';

  const hostParts = hostSource.split(':');
  const hostName = hostParts[0];
  const hostPort = process.env.HLS_PORT || hostParts[1] || '';
  const hostWithPort = hostPort ? `${hostName}:${hostPort}` : hostName;

  const pathPrefix = (process.env.HLS_PATH || '/hls').replace(/\/+$/, '');
  const nested = String(process.env.HLS_NESTED || '').toLowerCase() === 'on';

  // nginx-rtmp: hls_nested on -> /hls/<key>/index.m3u8
  // hls_nested off (default) -> /hls/<key>.m3u8
  const path = nested
    ? `${pathPrefix}/${streamKey}/index.m3u8`
    : `${pathPrefix}/${streamKey}.m3u8`;

  return `${proto}://${hostWithPort}${path}`;
};

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
      {
        $set: {
          userId,
          title,
          isLive: true,
          startedAt: new Date(),
          vodUrl: undefined,
        },
      },
      { new: true, upsert: true }
    );

    const rawHost =
      process.env.MEDIA_HOST ||
      (req.headers['x-forwarded-host'] || '').split(',')[0] ||
      (req.headers.host || '').split(':')[0] ||
      '127.0.0.1';

    const publishRtmp = `rtmp://${rawHost}:1935/live/${streamKey}`;
    const playbackUrl = buildPlaybackUrl(req, streamKey);

    // Push trusted users that stream is starting
    try {
      const trustedKeyIds = (user.trustedPeople || [])
        .map(p => p.keyId)
        .filter(Boolean); // отправляем всем в trusted

      if (trustedKeyIds.length) {
        const trustedUsers = await User.find(
          { keyId: { $in: trustedKeyIds } },
          { fcmTokens: 1, keyId: 1 }
        );
        const tokens = Array.from(
          new Set(
            trustedUsers
              .flatMap(u => u.fcmTokens || [])
              .filter(t => typeof t === 'string' && t.length > 10)
          )
        );

        console.log('[startStream push] recipients', {
          userId: String(userId),
          trusted: trustedKeyIds,
          trustedWithTokens: trustedUsers
            .filter(u => (u.fcmTokens || []).length > 0)
            .map(u => u.keyId),
          tokenCount: tokens.length,
        });

        const titleText = `${user.username || 'Пользователь'} начал трансляцию`;
        const bodyText = title;

        await Promise.allSettled(
          tokens.map(token =>
            sendFcm({
              token,
              title: titleText,
              body: bodyText,
              data: {
                action: 'open_stream',
                streamId: String(stream._id),
                streamKey,
                playbackUrl,
                fromUsername: user.username || '',
                fromKeyId: user.keyId || '',
              },
            })
          )
        );
      }
    } catch (err) {
      console.error('[startStream push] error:', err);
    }

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

export const getActiveStreams = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId).select(
      'trustedPeople'
    );
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const trustedKeyIds = (currentUser.trustedPeople || [])
      .map(p => p.keyId)
      .filter(Boolean);

    if (trustedKeyIds.length === 0) {
      return res.json([]);
    }

    const trustedUsers = await User.find(
      { keyId: { $in: trustedKeyIds } },
      { _id: 1, username: 1, keyId: 1 }
    );
    const userById = new Map(
      trustedUsers.map(u => [String(u._id), u.toObject()])
    );
    const trustedUserIds = trustedUsers.map(u => u._id);

    const streams = await LiveStream.find({
      userId: { $in: trustedUserIds },
      isLive: true,
    });

    const payload = streams.map(s => {
      const owner = userById.get(String(s.userId)) || {};
      return {
        streamId: s._id,
        streamKey: s.streamKey,
        title: s.title || 'Live Stream',
        startedAt: s.startedAt || s.createdAt,
        playbackUrl: buildPlaybackUrl(req, s.streamKey),
        fromUser: {
          id: owner._id,
          username: owner.username,
          keyId: owner.keyId,
        },
      };
    });

    return res.json(payload);
  } catch (e) {
    console.error('[getActiveStreams] error:', e);
    return res.status(500).json({ error: e.message });
  }
};
