// import express from 'express';
// import { authenticateToken } from '../middleware/auth.middleware.js';
// import {
//   startStream,
//   onPublish,
//   onDone,
// } from '../controllers/stream.controller.js';

// const router = express.Router();

// router.post('/start', authenticateToken, startStream);
// router.post('/hooks/on_publish', onPublish);
// router.post('/hooks/on_done', onDone);

// export default router;

import { Router } from 'express';
import { startStream } from '../controllers/stream.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();
router.post('/start', authenticateToken, startStream);
export default router;

// import { Router } from 'express';
// import LiveStream from '../models/LiveStream.js';
// import crypto from 'crypto';

// const router = Router();

// router.post('/start', async (req, res) => {
//   const userId = req.user._id; // у тебя есть auth middleware
//   const streamKey = crypto.randomBytes(8).toString('hex'); // 16 hex символов

//   const stream = await LiveStream.create({ userId, streamKey, isLive: false });

//   // вернём и streamId (Mongo) и RTMP publish URL
//   const publish = `rtmp://${
//     process.env.RTMP_HOST || req.hostname
//   }:1935/live/${streamKey}`;

//   res.json({
//     ok: true,
//     streamId: stream._id,
//     streamKey,
//     publish, // это то, во что паблишит приложение
//   });
// });

// export default router;
