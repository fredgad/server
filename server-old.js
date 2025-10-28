// import bodyParser from 'body-parser';
// import cors from 'cors';
// import express from 'express';
// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// import bcrypt from 'bcrypt';
// import jwt from 'jsonwebtoken';
// import grid from 'gridfs-stream';
// import { GridFsStorage } from 'multer-gridfs-storage';
// import multer from 'multer';
// import http from 'http';
// import { Server } from 'socket.io';
// import userModel from './app/models/user.model.js';
// import StreamModel from './app/models/stream.model.js';
// import HLSSegment from './app/models/hls-segment.model.js';
// import VideoChunkModel from './app/models/video-chunk.model.js';
// import { generateUniqueKeyId } from './app/utils/generate-unique-key-id.js';
// import webpush from 'web-push';
// import ffmpeg from 'fluent-ffmpeg';
// import ffprobeStatic from 'ffprobe-static';

// ffmpeg.setFfprobePath(ffprobeStatic.path);

// const vapidKeys = {
//   publicKey: process.env.VAPID_PUBLIC_KEY,
//   privateKey: process.env.VAPID_PRIVATE_KEY,
// };

// const VAPID_PUBLIC_KEY =
//   'BMjIBfz0QCcmGNE32T7hR8l0RDDB4WQUkyLIRzc7qqGby4q4McrDiqRknFsTOPDsy53rioiTsjspXve7k2idJRc';
// const VAPID_PRIVATE_KEY = 'kCdXufMEcnFX9EHOURWFgffRJnuycFl44fjpOfMis20';
// webpush.setVapidDetails(
//   'mailto:fred_gad@mail.ru',
//   VAPID_PUBLIC_KEY,
//   VAPID_PRIVATE_KEY
// );

// dotenv.config();

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// const secretKey = process.env.SECRET_KEY;
// const PORT = process.env.PORT || 9000;
// // const uri = 'mongodb+srv://gad4red:7ecGfnIlbfJXd6k3@cluster-msr.0qeia.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-msr';
// const uri = process.env.MONGO_URL;

// const corsOptions = {
//   origin: ['http://localhost:4200', 'https://msr-pro.web.app'],
//   optionsSuccessStatus: 200,
// };

// app.use(cors(corsOptions));
// app.use(bodyParser.json({ limit: '50mb' }));
// app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// let gfs, gridfsBucket;

// async function connectToMongoDB() {
//   try {
//     await mongoose
//       .connect(uri, {
//         serverApi: {
//           version: '1',
//           strict: true,
//           deprecationErrors: true,
//         },
//       })
//       .then(() => {
//         console.log('Connected to MongoDB Atlas');
//       })
//       .catch(err =>
//         console.error('Could not connect to MongoDB Atlas...', err)
//       );
//     console.log('Connected to MongoDB.');

//     // Configure GridFS
//     gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
//       bucketName: 'uploads',
//     });
//     gfs = grid(mongoose.connection.db, mongoose.mongo);
//     gfs.collection('uploads');
//   } catch (err) {
//     console.error('Could not connect to MongoDB...', err);
//     process.exit(1); // Exit if unable to connect
//   }
// }
// connectToMongoDB();

// async function ffprobeInfoByGridFsFilename(filename) {
//   return new Promise(resolve => {
//     const rs = gridfsBucket.openDownloadStreamByName(filename);
//     ffmpeg(rs).ffprobe((err, data) => {
//       if (err || !data) return resolve({});
//       const fmt = data.format || {};
//       const streams = Array.isArray(data.streams) ? data.streams : [];
//       const v = streams.find(s => s.codec_type === 'video') || {};
//       const a = streams.find(s => s.codec_type === 'audio') || {};
//       resolve({
//         duration:
//           typeof fmt.duration === 'number'
//             ? fmt.duration
//             : fmt.duration
//             ? Number(fmt.duration)
//             : null,
//         vcodec: v.codec_name || null,
//         acodec: a.codec_name || null,
//         width: v.width || null,
//         height: v.height || null,
//       });
//     });
//   });
// }

// async function ffprobeDurationByGridFsFilename(filename) {
//   const info = await ffprobeInfoByGridFsFilename(filename);
//   return info.duration;
// }

// // MP4 -> TS с перекодированием в H.264/AAC (совместимо с большинством плееров)
// function remuxMp4ToTs(inFilename, outTsFilename) {
//   return new Promise((resolve, reject) => {
//     const inRs = gridfsBucket.openDownloadStreamByName(inFilename);
//     const outWs = gridfsBucket.openUploadStream(outTsFilename, {
//       contentType: 'video/mp2t', // важно: именно mp2t
//     });

//     outWs.on('finish', () => resolve()); // ждём flush в GridFS

//     ffmpeg(inRs)
//       .inputOptions(['-fflags +genpts']) // нормализуем таймстампы
//       .outputOptions([
//         '-f mpegts',
//         '-muxdelay 0',
//         '-muxpreload 0',
//         '-flush_packets 1',
//         '-mpegts_flags +resend_headers+initial_discontinuity',
//         '-map 0:v:0?',
//         '-map 0:a:0?',
//         // ВИДЕО
//         '-c:v libx264',
//         '-preset veryfast',
//         '-tune zerolatency',
//         '-profile:v baseline',
//         '-level 3.1',
//         '-pix_fmt yuv420p',
//         '-g 60', // GOP ~2с (при 30fps)
//         '-keyint_min 60',
//         // АУДИО
//         '-c:a aac',
//         '-b:a 128k',
//         '-ac 2',
//         '-ar 48000',
//       ])
//       .format('mpegts')
//       .on('error', err => {
//         console.error('ffmpeg H264 transcode error:', err?.message || err);
//         reject(err);
//       })
//       .pipe(outWs, { end: true });
//   });
// }

// async function makeTsFromMp4(inFilename, outTsFilename) {
//   const info = await ffprobeInfoByGridFsFilename(inFilename);
//   const vcodec = (info.vcodec || '').toLowerCase();

//   return new Promise((resolve, reject) => {
//     const inRs = gridfsBucket.openDownloadStreamByName(inFilename);
//     const outWs = gridfsBucket.openUploadStream(outTsFilename, {
//       contentType: 'video/MP2T',
//     });

//     outWs.on('finish', () => resolve());
//     outWs.on('error', reject);

//     const cmd = ffmpeg(inRs)
//       .on('error', reject)
//       .on('end', () => {
//         /* outWs закроется сам, затем 'finish' */
//       });

//     if (vcodec === 'h264') {
//       // Быстрый путь — без перекодирования
//       cmd
//         .inputOptions(['-fflags +genpts']) // генерить PTS если нужно
//         .outputOptions([
//           '-muxdelay 0',
//           '-muxpreload 0',
//           '-vsync 1',
//           '-copyts',
//           '-avoid_negative_ts make_zero',
//           '-c copy',
//           '-bsf:v h264_mp4toannexb',
//           '-f mpegts',
//         ])
//         .format('mpegts')
//         .pipe(outWs, { end: true });
//     } else {
//       // Перекодируем в H.264, чтобы точно играло в HLS
//       // Параметры подобраны для живых коротких кусков
//       cmd
//         .videoCodec('libx264')
//         .audioCodec('aac')
//         .inputOptions(['-fflags +genpts'])
//         .outputOptions([
//           '-preset veryfast',
//           '-tune zerolatency',
//           '-profile:v baseline',
//           '-level 3.1',
//           '-x264-params',
//           'keyint=60:min-keyint=60:scenecut=0', // ключевой кадр каждые ~2 сек @30fps
//           '-ac 1',
//           '-b:a 64k',
//           '-muxdelay 0',
//           '-muxpreload 0',
//           '-vsync 1',
//           '-f mpegts',
//         ])
//         .format('mpegts')
//         .pipe(outWs, { end: true });
//     }
//   });
// }

// const storage = new GridFsStorage({
//   url: uri,
//   options: { useUnifiedTopology: true },
//   file: (req, file) => {
//     // Разрешаем только MP4
//     const isMp4Mime =
//       (file.mimetype || '').toLowerCase() === 'video/mp4' ||
//       (file.mimetype || '').toLowerCase() === 'application/octet-stream'; // иногда мобильные клиенты шлют octet-stream

//     const original = (file.originalname || '').toLowerCase();
//     const hasMp4Ext = original.endsWith('.mp4');

//     if (!isMp4Mime && !hasMp4Ext) {
//       // отклоняем не-mp4 (можно вернуть 415 на роуте — см. ниже)
//       return null; // заставит multer выкинуть ошибку "File not allowed"
//     }

//     // Всегда сохраняем с расширением .mp4 + contentType: video/mp4
//     const filename =
//       `${Date.now()}-${file.originalname || 'video'}`
//         .replace(/\s+/g, '_')
//         .replace(/\.[^.]+$/, '') + '.mp4';

//     return Promise.resolve({
//       bucketName: 'uploads', // твой бакет
//       filename,
//       contentType: 'video/mp4',
//       metadata: {
//         originalname: file.originalname,
//         uploadedAt: new Date().toISOString(),
//         forcedMp4: true,
//       },
//     });
//   },
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
//   fileFilter: (req, file, cb) => {
//     const name = (file.originalname || '').toLowerCase();
//     const mime = (file.mimetype || '').toLowerCase();
//     const ok =
//       mime === 'video/mp4' ||
//       name.endsWith('.mp4') ||
//       mime === 'application/octet-stream';
//     if (!ok) return cb(new Error('ONLY_MP4_ALLOWED'));
//     cb(null, true);
//   },
// }).single('file');

// server.listen(PORT, '0.0.0.0', () => {
//   console.log(`Listening mongo on ${PORT}`);
// });

// app.post('/register', async (req, res) => {
//   try {
//     const hashedPassword = await bcrypt.hash(req.body.password, 10);
//     const keyId = await generateUniqueKeyId();

//     const user = new userModel({
//       username: req.body.username,
//       email: req.body.email,
//       password: hashedPassword,
//       keyId,
//     });

//     const newUser = await user.save();
//     const token = jwt.sign({ userId: newUser._id }, secretKey, {
//       expiresIn: '24h',
//     });

//     res.status(201).json({ token });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post('/login', async (req, res) => {
//   const user = await userModel.findOne({
//     $or: [{ username: req.body.login }, { email: req.body.login }],
//   });

//   if (user && (await bcrypt.compare(req.body.password, user.password))) {
//     const token = jwt.sign({ userId: user._id }, secretKey, {
//       expiresIn: '24h',
//     });
//     res.json({ token });
//   } else {
//     res.status(401).send('Неверные учетные данные');
//   }
// });

// // Middleware для верификации токена
// const authenticateToken = (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
//   if (!token) return res.status(401).send('Токен не предоставлен');

//   jwt.verify(token, secretKey, (err, user) => {
//     if (err) return res.status(403).send('Недействительный токен');
//     req.user = user;
//     next();
//   });
// };

// // Защищенные маршруты
// app.get('/getUser', authenticateToken, async (req, res) => {
//   try {
//     const user = await userModel.findById(req.user.userId).select('-password'); // Исключаем пароль из ответа
//     if (!user) return res.status(404).send('Пользователь не найден');

//     res.json(user);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post('/getTrustedUsersByKeyIds', authenticateToken, async (req, res) => {
//   try {
//     const { keyIds } = req.body;

//     if (!keyIds || !Array.isArray(keyIds) || keyIds.length === 0) {
//       return res.status(400).json({ error: 'keyIds array is required' });
//     }

//     const users = await userModel.find(
//       { keyId: { $in: keyIds } },
//       { username: 1, email: 1, keyId: 1, image: 1, videos: 1 }
//     );

//     res.status(200).json(users);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post('/saveImage', authenticateToken, async (req, res) => {
//   console.log('Image file uploaded');
//   const authHeader = req.headers['authorization'];
//   const token = authHeader && authHeader.split(' ')[1];
//   if (!token) return res.status(401).send('Токен не предоставлен');

//   try {
//     const decoded = jwt.verify(token, secretKey);
//     const userId = decoded.userId;
//     const image = req.body.image;

//     if (!image) {
//       return res.status(400).json({ error: 'Image is required' });
//     }

//     const updatedUser = await userModel.findByIdAndUpdate(
//       userId,
//       { image: image },
//       { new: true }
//     );
//     if (updatedUser) {
//       res.status(200).json({ message: 'Image updated successfully' });
//     } else {
//       res.status(404).json({ error: 'User not found' });
//     }
//   } catch (error) {
//     if (error instanceof jwt.JsonWebTokenError) {
//       res.status(403).json({ error: 'Invalid token' });
//     } else {
//       res.status(500).json({ error: error.message });
//     }
//   }
// });

// app.post('/addUserByKeyId', authenticateToken, async (req, res) => {
//   try {
//     const decoded = jwt.verify(
//       req.headers['authorization'].split(' ')[1],
//       secretKey
//     );
//     const requesterId = decoded.userId;
//     const targetKeyId = req.body.keyId;

//     if (!targetKeyId) {
//       return res.status(400).json({ error: 'keyId is required' });
//     }

//     const requester = await userModel.findById(requesterId);
//     if (!requester) {
//       return res.status(404).json({ error: 'Requester not found' });
//     }

//     if (requester.keyId === targetKeyId) {
//       return res
//         .status(400)
//         .json({ error: 'You cannot send a request to yourself' });
//     }

//     const targetUser = await userModel.findOne({ keyId: targetKeyId });
//     if (!targetUser) {
//       return res.status(404).json({ error: 'Target user not found' });
//     }

//     const isAlreadyTrusted = requester.trustedPeople.some(
//       person => person.keyId === targetKeyId
//     );
//     if (isAlreadyTrusted) {
//       return res
//         .status(400)
//         .json({ error: 'User is already in your trusted list' });
//     }

//     if (requester.outgoingReq.includes(targetKeyId)) {
//       return res
//         .status(400)
//         .json({ error: 'Request already sent to this user' });
//     }
//     if (targetUser.incomingReq.includes(requester.keyId)) {
//       return res
//         .status(400)
//         .json({ error: 'Request already received from this user' });
//     }

//     requester.outgoingReq.push(targetKeyId);
//     targetUser.incomingReq.push(requester.keyId);

//     await requester.save();
//     await targetUser.save();

//     res.status(200).json({ message: 'Request sent successfully' });
//   } catch (error) {
//     if (error instanceof jwt.JsonWebTokenError) {
//       res.status(403).json({ error: 'Invalid token' });
//     } else {
//       res.status(500).json({ error: error.message });
//     }
//   }
// });

// app.post('/cancelRequest', authenticateToken, async (req, res) => {
//   try {
//     const decoded = jwt.verify(
//       req.headers['authorization'].split(' ')[1],
//       secretKey
//     );
//     const currentUserKeyId = decoded.userId;
//     const targetKeyId = req.body.keyId;

//     if (!targetKeyId) {
//       return res.status(400).json({ error: 'keyId is required' });
//     }

//     const currentUser = await userModel.findById(currentUserKeyId);
//     if (!currentUser) {
//       return res.status(404).json({ error: 'Current user not found' });
//     }

//     const targetUser = await userModel.findOne({ keyId: targetKeyId });
//     if (!targetUser) {
//       return res.status(404).json({ error: 'Target user not found' });
//     }

//     currentUser.incomingReq = currentUser.incomingReq.filter(
//       id => id !== targetKeyId
//     );

//     targetUser.outgoingReq = targetUser.outgoingReq.filter(
//       id => id !== currentUser.keyId
//     );

//     currentUser.outgoingReq = currentUser.outgoingReq.filter(
//       id => id !== targetKeyId
//     );

//     targetUser.incomingReq = targetUser.incomingReq.filter(
//       id => id !== currentUser.keyId
//     );

//     await currentUser.save();
//     await targetUser.save();

//     res.status(200).json({ message: 'Request canceled successfully' });
//   } catch (error) {
//     if (error instanceof jwt.JsonWebTokenError) {
//       res.status(403).json({ error: 'Invalid token' });
//     } else {
//       res.status(500).json({ error: error.message });
//     }
//   }
// });

// app.post('/acceptTrustedUser', authenticateToken, async (req, res) => {
//   try {
//     const decoded = jwt.verify(
//       req.headers['authorization'].split(' ')[1],
//       secretKey
//     );
//     const currentUserKeyId = decoded.userId;
//     const targetKeyId = req.body.keyId;

//     if (!targetKeyId) {
//       return res.status(400).json({ error: 'keyId is required' });
//     }

//     const currentUser = await userModel.findById(currentUserKeyId);
//     if (!currentUser) {
//       return res.status(404).json({ error: 'Current user not found' });
//     }

//     const targetUser = await userModel.findOne({ keyId: targetKeyId });
//     if (!targetUser) {
//       return res.status(404).json({ error: 'Target user not found' });
//     }

//     currentUser.incomingReq = currentUser.incomingReq.filter(
//       id => id !== targetKeyId
//     );
//     currentUser.outgoingReq = currentUser.outgoingReq.filter(
//       id => id !== targetKeyId
//     );

//     targetUser.incomingReq = targetUser.incomingReq.filter(
//       id => id !== currentUser.keyId
//     );
//     targetUser.outgoingReq = targetUser.outgoingReq.filter(
//       id => id !== currentUser.keyId
//     );

//     if (!currentUser.trustedPeople) currentUser.trustedPeople = [];
//     if (!targetUser.trustedPeople) targetUser.trustedPeople = [];

//     if (
//       !currentUser.trustedPeople.some(person => person.keyId === targetKeyId)
//     ) {
//       currentUser.trustedPeople.push({ keyId: targetKeyId, displayed: true });
//     }
//     if (
//       !targetUser.trustedPeople.some(
//         person => person.keyId === currentUser.keyId
//       )
//     ) {
//       targetUser.trustedPeople.push({
//         keyId: currentUser.keyId,
//         displayed: true,
//       });
//     }

//     await currentUser.save();
//     await targetUser.save();

//     res
//       .status(200)
//       .json({ message: 'User added to trusted list successfully' });
//   } catch (error) {
//     if (error instanceof jwt.JsonWebTokenError) {
//       res.status(403).json({ error: 'Invalid token' });
//     } else {
//       res.status(500).json({ error: error.message });
//     }
//   }
// });

// app.post('/removeTrustedUser', authenticateToken, async (req, res) => {
//   try {
//     const decoded = jwt.verify(
//       req.headers['authorization'].split(' ')[1],
//       secretKey
//     );
//     const requesterId = decoded.userId;
//     const targetKeyId = req.body.keyId;

//     if (!targetKeyId) {
//       return res.status(400).json({ error: 'keyId is required' });
//     }

//     const requester = await userModel.findById(requesterId);
//     if (!requester) {
//       return res.status(404).json({ error: 'Requester not found' });
//     }

//     const targetUser = await userModel.findOne({ keyId: targetKeyId });
//     if (!targetUser) {
//       return res.status(404).json({ error: 'Target user not found' });
//     }

//     requester.trustedPeople = requester.trustedPeople.filter(
//       person => person.keyId !== targetKeyId
//     );

//     targetUser.trustedPeople = targetUser.trustedPeople.filter(
//       person => person.keyId !== requester.keyId
//     );

//     await requester.save();
//     await targetUser.save();

//     res.status(200).json({ message: 'Trusted user removed successfully' });
//   } catch (error) {
//     if (error instanceof jwt.JsonWebTokenError) {
//       res.status(403).json({ error: 'Invalid token' });
//     } else {
//       res.status(500).json({ error: error.message });
//     }
//   }
// });

// // Upload Video Route
// app.post(
//   '/uploadVideo',
//   authenticateToken,
//   (req, res, next) => {
//     upload(req, res, err => {
//       if (err && err.message === 'ONLY_MP4_ALLOWED') {
//         return res.status(415).json({ error: 'Only MP4 is allowed' });
//       }
//       if (err) return next(err);
//       next();
//     });
//   },
//   async (req, res) => {
//     try {
//       if (!req.file) {
//         return res.status(400).json({ error: 'No file uploaded.' });
//       }

//       const protocol = req.headers['x-forwarded-proto'] || req.protocol;
//       const fullUrl = `${protocol}://${req.get('host')}/uploads/${
//         req.file.filename
//       }`;

//       const video = {
//         url: fullUrl,
//         createdAt: Date.now(),
//       };

//       const userId = req.user.userId;
//       const user = await userModel.findById(userId);
//       if (!user) return res.status(404).json({ error: 'User not found' });

//       user.videos.push(video);
//       await user.save();

//       res.status(200).json({ message: 'Видео успешно загружено', video });

//       // ... (твои push-уведомления как было)
//     } catch (error) {
//       console.error('Error uploading video:', error);
//       res.status(500).json({ error: error.message });
//     }
//   }
// );

// app.get('/uploads/:filename', async (req, res) => {
//   try {
//     const filename = req.params.filename;
//     const filesCol = mongoose.connection.db.collection('uploads.files');

//     const file = await filesCol.findOne({ filename });
//     if (!file) return res.status(404).json({ error: 'File not found' });

//     const size = file.length;
//     const mime = file.contentType || 'video/mp4';
//     const range = req.headers.range;

//     res.set('Accept-Ranges', 'bytes');
//     res.set('Content-Type', mime);

//     if (!range) {
//       // отдаём целиком (200) с Content-Length
//       res.set('Content-Length', String(size));
//       const dl = gridfsBucket.openDownloadStreamByName(filename);
//       dl.on('error', err => {
//         console.error('GridFS download error', err);
//         res.sendStatus(404);
//       });
//       return dl.pipe(res);
//     }

//     // Range: bytes=start-end
//     const m = /bytes=(\d*)-(\d*)/.exec(range);
//     let start = m && m[1] ? parseInt(m[1], 10) : 0;
//     let end = m && m[2] ? parseInt(m[2], 10) : size - 1;

//     if (Number.isNaN(start) || start < 0) start = 0;
//     if (Number.isNaN(end) || end >= size) end = size - 1;
//     if (start > end || start >= size) {
//       res.status(416).set('Content-Range', `bytes */${size}`).end();
//       return;
//     }

//     const chunkLen = end - start + 1;

//     res.status(206).set({
//       'Content-Range': `bytes ${start}-${end}/${size}`,
//       'Content-Length': String(chunkLen),
//       'Cache-Control': 'no-cache',
//     });

//     // end у GridFS эксклюзивный
//     const dl = gridfsBucket.openDownloadStreamByName(filename, {
//       start,
//       end: end + 1,
//     });
//     dl.on('error', err => {
//       console.error('GridFS ranged download error', err);
//       res.sendStatus(404);
//     });
//     dl.pipe(res);
//   } catch (error) {
//     console.error('Error retrieving file with range:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// app.get('/getUserVideos', authenticateToken, async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     const user = await userModel.findById(userId);

//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     res.status(200).json({ videos: user.videos });
//   } catch (error) {
//     console.error('Error retrieving user videos:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// app.post('/deleteUserVideo', authenticateToken, async (req, res) => {
//   console.log('deleteUserVideo', req.body);
//   try {
//     const userId = req.user.userId;
//     const { url, createdAt } = req.body;

//     if (!url || !createdAt) {
//       return res
//         .status(400)
//         .json({ error: 'Missing required fields: url or createdAt' });
//     }

//     const user = await userModel.findById(userId);

//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     const videoIndex = user.videos.findIndex(
//       video =>
//         video.url === url &&
//         new Date(video.createdAt).getTime() === new Date(createdAt).getTime()
//     );

//     if (videoIndex === -1) {
//       return res.status(404).json({ error: 'Video not found' });
//     }

//     // const filename = url.split('/uploads/')[1];

//     // if (!filename) {
//     //   return res.status(400).json({ error: 'Invalid video URL' });
//     // }

//     // // Удалить файл из GridFS
//     // const file = await gfs.files.findOne({ filename });
//     // if (!file) {
//     //   return res.status(404).json({ error: 'File not found in GridFS' });
//     // }

//     // await gridfsBucket.delete(file._id);

//     if (url.includes('/uploads/')) {
//       const filename = url.split('/uploads/')[1];
//       const file = await gfs.files.findOne({ filename });

//       if (!file) {
//         return res.status(404).json({ error: 'File not found in GridFS' });
//       }

//       await gridfsBucket.delete(file._id);
//     } else if (url.includes('/hls/')) {
//       // пример: http(s)://host/hls/<streamId>/index.m3u8
//       const m = url.match(/\/hls\/([^/]+)\/index\.m3u8/);
//       if (!m) {
//         return res.status(400).json({ error: 'Invalid HLS URL format' });
//       }
//       const streamId = m[1];

//       // найдём все сегменты и удалим их файлы
//       const segs = await HLSSegment.find({ streamId });
//       for (const s of segs) {
//         try {
//           const file = await gfs.files.findOne({ filename: s.filename });
//           if (file) await gridfsBucket.delete(file._id);
//         } catch (err) {
//           console.error(`Ошибка удаления сегмента ${s.filename}:`, err.message);
//         }
//       }
//       // подчистим документы
//       await HLSSegment.deleteMany({ streamId });
//     } else if (url.includes('/streamChunks/')) {
//       const streamId = url.split('/streamChunks/')[1];

//       const chunks = await VideoChunkModel.find({ streamId });

//       for (const chunk of chunks) {
//         try {
//           const file = await gfs.files.findOne({ filename: chunk.filename });
//           if (file) {
//             await gridfsBucket.delete(file._id);
//           }
//         } catch (err) {
//           console.error(
//             `Ошибка при удалении файла ${chunk.filename}:`,
//             err.message
//           );
//         }
//       }

//       await VideoChunkModel.deleteMany({ streamId });
//     } else {
//       return res.status(400).json({ error: 'Invalid video URL format' });
//     }

//     const removedVideo = user.videos.splice(videoIndex, 1);

//     await user.save();

//     res.status(200).json({
//       message: 'Video deleted successfully',
//       video: removedVideo[0],
//     });
//   } catch (error) {
//     console.error('Error deleting user video:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// });

// app.post('/saveSubscription', authenticateToken, async (req, res) => {
//   console.log('/saveSubscription', req.body);
//   try {
//     const userId = req.user.userId;
//     const subscription = req.body.subscription;
//     if (!subscription) {
//       return res.status(400).json({ error: 'Subscription object is required' });
//     }

//     const user = await userModel.findById(userId);
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     const alreadyExists = user.pushSubscriptions.some(
//       sub => sub.endpoint === subscription.endpoint
//     );
//     if (!alreadyExists) {
//       user.pushSubscriptions.push(subscription);
//       await user.save();
//     }

//     res.status(200).json({ message: 'Subscription saved successfully' });
//   } catch (error) {
//     console.error('Error saving subscription:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post('/startStream', authenticateToken, async (req, res) => {
//   try {
//     const userId = req.user.userId;

//     const newStream = new StreamModel({ userId, title: req.body.title });
//     await newStream.save();

//     console.log('[START_STREAM]', { userId, streamId: String(newStream._id) });

//     const currentUser = await userModel.findById(userId);
//     const trustedKeyIds = currentUser.trustedPeople.map(t => t.keyId);

//     const trustedUsers = await userModel.find({
//       keyId: { $in: trustedKeyIds },
//     });

//     for (const trustedUser of trustedUsers) {
//       trustedUser.notifications.unshift({
//         type: 'stream_start',
//         text: `${currentUser.username} начал прямую трансляцию`,
//         streamId: newStream._id,
//         fromUser: currentUser.username,
//         createdAt: new Date(),
//         isRead: false,
//       });
//       if (trustedUser.notifications.length > 50) {
//         trustedUser.notifications = trustedUser.notifications.slice(0, 50);
//       }
//       await trustedUser.save();

//       if (
//         trustedUser.pushSubscriptions &&
//         trustedUser.pushSubscriptions.length
//       ) {
//         for (const subscription of trustedUser.pushSubscriptions) {
//           try {
//             await webpush.sendNotification(
//               subscription,
//               JSON.stringify({
//                 title: 'Началась трансляция!',
//                 body: `${currentUser.username} начал прямую трансляцию.`,
//                 streamId: newStream._id,
//                 icon: '/assets/icons/icon-192x192.png',
//               })
//             );
//           } catch (pushError) {
//             console.error(
//               'Push уведомление не отправлено:',
//               pushError.message || pushError
//             );
//             // Можно добавить очистку невалидных подписок, если нужно
//           }
//         }
//       }
//     }

//     res.status(200).json({
//       streamId: newStream._id,
//       playback: {
//         type: 'hls',
//         url: `${req.protocol}://${req.get('host')}/hls/${
//           newStream._id
//         }/index.m3u8`,
//       },
//     });
//   } catch (error) {
//     console.error('Ошибка старта трансляции:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post(
//   '/uploadStreamChunk',
//   authenticateToken,
//   (req, res, next) => {
//     upload(req, res, err => {
//       if (err && err.message === 'ONLY_MP4_ALLOWED') {
//         return res.status(415).json({ error: 'Only MP4 is allowed' });
//       }
//       if (err) return next(err);
//       next();
//     });
//   },
//   async (req, res) => {
//     try {
//       const { streamId, chunkNumber } = req.body;
//       console.log('[UPLOAD_CHUNK] req.body =', {
//         streamId,
//         chunkNumber,
//         file: req.file?.filename,
//       });

//       if (!req.file?.filename) {
//         console.error('[UPLOAD_CHUNK] NO FILE?');
//         return res.status(400).json({ error: 'No file' });
//       }
//       if (!streamId) {
//         return res.status(400).json({ error: 'Missing streamId' });
//       }

//       let sid;
//       try {
//         sid = new mongoose.Types.ObjectId(streamId);
//       } catch {
//         return res.status(400).json({ error: 'Bad streamId' });
//       }

//       const chunkMeta = new VideoChunkModel({
//         streamId: sid, // <-- принудительно ObjectId
//         chunkNumber: parseInt(chunkNumber, 10) || 0,
//         filename: req.file.filename,
//       });

//       await chunkMeta.save();

//       try {
//         // Получаем инфо о входном MP4
//         const info = await ffprobeInfoByGridFsFilename(req.file.filename);
//         const dur = info.duration && info.duration > 0 ? info.duration : 2;

//         // Имя .ts
//         const tsName = `hls_${String(sid)}_${chunkMeta.chunkNumber}.ts`;

//         // Собираем TS (copy для h264; иначе перекодируем в h264)
//         await makeTsFromMp4(req.file.filename, tsName);

//         // Сохраняем запись о сегменте
//         await HLSSegment.create({
//           streamId: sid,
//           seq: chunkMeta.chunkNumber,
//           filename: tsName,
//           duration: dur,
//         });

//         console.log('[UPLOAD_CHUNK][HLS] created segment', {
//           streamId: String(sid),
//           seq: chunkMeta.chunkNumber,
//           ts: tsName,
//           duration: dur,
//           vcodec: info.vcodec,
//         });
//       } catch (segErr) {
//         console.error(
//           '[UPLOAD_CHUNK][HLS] failed to build TS segment:',
//           segErr
//         );
//         return res.status(500).json({ error: 'HLS segmentation failed' });
//       }

//       console.log('[UPLOAD_CHUNK] saved meta', {
//         streamId: String(sid),
//         chunkNumber: chunkMeta.chunkNumber,
//         filename: chunkMeta.filename,
//       });

//       res.status(200).json({ ok: true, seq: chunkMeta.chunkNumber });
//     } catch (error) {
//       console.error('uploadStreamChunk error:', error);
//       res.status(500).json({ error: error.message });
//     }
//   }
// );

// app.get('/streamChunks/:streamId', async (req, res) => {
//   try {
//     const { streamId } = req.params;

//     let sid;
//     try {
//       sid = new mongoose.Types.ObjectId(req.params.streamId);
//     } catch {
//       return res.status(400).send('Bad streamId');
//     }

//     console.log('[GET_STREAM] and sid to compare', req.params.streamId, sid);

//     const chunks = await VideoChunkModel.find({ streamId: sid }).sort({
//       chunkNumber: 1,
//     });

//     console.log('[GET_STREAM] chunks found =', chunks.length);

//     if (!chunks.length) {
//       return res.status(404).send('Трансляция не найдена или ещё не началась');
//     }

//     // 2) получим размеры файлов по именам из коллекции uploads.files
//     const filesCol = mongoose.connection.db.collection('uploads.files');

//     const meta = await filesCol
//       .find({ filename: { $in: chunks.map(c => c.filename) } })
//       .project({ filename: 1, length: 1, contentType: 1 })
//       .toArray();

//     // filename -> length
//     const sizeByName = new Map(meta.map(m => [m.filename, m.length]));
//     const mime = 'video/mp4';

//     // 3) построим префиксные суммы длин, чтобы знать общий размер
//     const offsets = []; // [{filename,start,end}]
//     let total = 0;
//     for (const c of chunks) {
//       const len = sizeByName.get(c.filename) || 0;
//       const start = total;
//       const end = total + Math.max(0, len) - 1;
//       offsets.push({ filename: c.filename, start, end });
//       total += Math.max(0, len);
//     }
//     if (total <= 0) return res.status(404).send('Empty stream');

//     res.set('Accept-Ranges', 'bytes');
//     res.set('Content-Type', mime);

//     const range = req.headers.range;

//     // 4) без Range — отдаём целиком (200) последовательно
//     if (!range) {
//       res.set('Content-Length', String(total));
//       let idx = 0;

//       const pipeNext = () => {
//         if (idx >= offsets.length) return res.end();
//         const { filename } = offsets[idx++];
//         const rs = gridfsBucket.openDownloadStreamByName(filename);
//         rs.on('error', err => {
//           console.error('GridFS concat error', err);
//           res.end(); // завершим поток
//         });
//         rs.on('end', pipeNext);
//         rs.pipe(res, { end: false });
//       };

//       return pipeNext();
//     }

//     // 5) с Range — ответ 206 и выбор нужных частей
//     const m = /bytes=(\d*)-(\d*)/.exec(range);
//     let start = m && m[1] ? parseInt(m[1], 10) : 0;
//     let end = m && m[2] ? parseInt(m[2], 10) : total - 1;

//     if (Number.isNaN(start) || start < 0) start = 0;
//     if (Number.isNaN(end) || end >= total) end = total - 1;
//     if (start > end || start >= total) {
//       res.status(416).set('Content-Range', `bytes */${total}`).end();
//       return;
//     }

//     const chunkLen = end - start + 1;
//     res.status(206).set({
//       'Content-Range': `bytes ${start}-${end}/${total}`,
//       'Content-Length': String(chunkLen),
//       'Cache-Control': 'no-cache',
//     });

//     // найдём первый и последний файл, которые пересекают диапазон
//     let iStart = offsets.findIndex(o => o.end >= start);
//     let iEnd = offsets.findIndex(o => o.end >= end);
//     if (iEnd === -1) iEnd = offsets.length - 1;

//     const pipePart = i => {
//       if (i > iEnd) return res.end();

//       const o = offsets[i];
//       // локальные смещения внутри файла
//       const localStart = Math.max(0, start - o.start);
//       const localEnd = Math.min(o.end, end) - o.start; // инклюзивно
//       const rs = gridfsBucket.openDownloadStreamByName(o.filename, {
//         start: localStart,
//         end: localEnd + 1, // эксклюзивно
//       });

//       rs.on('error', err => {
//         console.error('GridFS ranged concat error', err);
//         res.end();
//       });
//       rs.on('end', () => pipePart(i + 1));
//       rs.pipe(res, { end: false });
//     };

//     pipePart(iStart);
//   } catch (error) {
//     console.error('Error streaming chunks:', error);
//     res.status(500).json({ error: 'Ошибка трансляции' });
//   }
// });

// app.post('/endStream', authenticateToken, async (req, res) => {
//   try {
//     const { streamId } = req.body;
//     const userId = req.user.userId;

//     console.log('[END_STREAM] incoming', { userId, streamId });

//     let sid;
//     try {
//       sid = new mongoose.Types.ObjectId(streamId);
//     } catch {
//       return res.status(400).json({ error: 'Bad streamId' });
//     }

//     const stream = await StreamModel.findOne({ _id: sid, userId });
//     if (!stream)
//       return res.status(404).json({ error: 'Трансляция не найдена' });

//     stream.isLive = false;
//     await stream.save();

//     // Хост берём из ENV, чтобы не пролетал 'localhost'
//     const publicHost = process.env.PUBLIC_HOST || req.get('host'); // например '192.168.0.13:9000'
//     const protocol =
//       process.env.PUBLIC_PROTO ||
//       req.headers['x-forwarded-proto'] ||
//       req.protocol;

//     const streamUrl = `${protocol}://${publicHost}/hls/${streamId}/index.m3u8`;
//     console.log('[END_STREAM] saving URL to user.videos', { streamUrl });

//     const user = await userModel.findById(userId);
//     user.videos.push({ url: streamUrl, createdAt: new Date() });
//     await user.save();

//     res.status(200).json({ message: 'ok', videoUrl: streamUrl });
//   } catch (error) {
//     console.error('endStream error', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get('/notifications', authenticateToken, async (req, res) => {
//   const user = await userModel
//     .findById(req.user.userId)
//     .select('notifications');
//   res.json(user.notifications);
// });

// app.post('/notifications/markRead', authenticateToken, async (req, res) => {
//   const { createdAt } = req.body;
//   const user = await userModel.findById(req.user.userId);

//   const notif = user.notifications.find(
//     n => n.createdAt.getTime() === new Date(createdAt).getTime()
//   );
//   if (notif) notif.isRead = true;
//   await user.save();
//   res.json({ success: true });
// });

// // Плейлист
// app.get('/hls/:streamId/index.m3u8', async (req, res) => {
//   try {
//     const { streamId } = req.params;

//     // приводим к ObjectId для корректного поиска
//     let sid;
//     try {
//       sid = new mongoose.Types.ObjectId(streamId);
//     } catch {
//       return res.status(400).send('Bad streamId');
//     }

//     const stream = await StreamModel.findById(sid);
//     if (!stream) return res.status(404).send('Stream not found');

//     const segs = await HLSSegment.find({ streamId: sid })
//       .sort({ seq: 1 })
//       .lean();

//     res.set('Content-Type', 'application/vnd.apple.mpegurl');
//     res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
//     res.set('Pragma', 'no-cache');
//     res.set('Expires', '0');

//     if (!segs.length) {
//       return res.send(
//         `#EXTM3U
// #EXT-X-VERSION:3
// #EXT-X-TARGETDURATION:4
// #EXT-X-MEDIA-SEQUENCE:0
// #EXT-X-ALLOW-CACHE:NO
// #EXT-X-INDEPENDENT-SEGMENTS
// `
//       );
//     }

//     const maxDur = Math.max(
//       ...segs.map(s => (s.duration && s.duration > 0 ? s.duration : 2))
//     );
//     const target = Math.max(2, Math.ceil(maxDur));
//     const live = stream.isLive !== false;

//     const lines = [
//       '#EXTM3U',
//       '#EXT-X-VERSION:3',
//       `#EXT-X-TARGETDURATION:${target}`,
//       `#EXT-X-MEDIA-SEQUENCE:${segs[0].seq}`,
//       '#EXT-X-ALLOW-CACHE:NO',
//       '#EXT-X-INDEPENDENT-SEGMENTS',
//       ...(live ? ['#EXT-X-PLAYLIST-TYPE:EVENT'] : ['#EXT-X-PLAYLIST-TYPE:VOD']),
//     ];

//     for (let i = 0; i < segs.length; i++) {
//       const s = segs[i];
//       if (i > 0) lines.push('#EXT-X-DISCONTINUITY');
//       const d = (s.duration && s.duration > 0 ? s.duration : 2).toFixed(3);
//       lines.push(`#EXTINF:${d},`);
//       lines.push(`/hls/${streamId}/seg_${s.seq}.ts`);
//     }

//     if (!live) lines.push('#EXT-X-ENDLIST');

//     return res.send(lines.join('\n') + '\n');
//   } catch (e) {
//     console.error('m3u8 error', e);
//     res.status(500).send('m3u8 error');
//   }
// });

// app.get('/hls/:streamId/seg_:seq.ts', async (req, res) => {
//   try {
//     const { streamId, seq } = req.params;

//     let sid;
//     try {
//       sid = new mongoose.Types.ObjectId(streamId);
//     } catch {
//       return res.status(400).send('Bad streamId');
//     }

//     // ищем по ObjectId + номеру
//     const row = await HLSSegment.findOne({
//       streamId: sid,
//       seq: Number(seq),
//     }).lean();
//     if (!row) return res.status(404).send('segment not found');

//     res.set('Content-Type', 'video/MP2T');
//     res.set('Cache-Control', 'no-cache');

//     const dl = gridfsBucket.openDownloadStreamByName(row.filename);
//     dl.on('error', err => {
//       console.error('segment stream error', err);
//       res.end();
//     });
//     dl.pipe(res);
//   } catch (e) {
//     console.error('segment error', e);
//     res.status(500).send('segment error');
//   }
// });

// // temporal debug endpoint to list stream chunks
// app.get('/debug/stream/:id', async (req, res) => {
//   try {
//     let sid;
//     try {
//       sid = new mongoose.Types.ObjectId(req.params.id);
//     } catch {
//       return res.status(400).json({ error: 'Bad streamId' });
//     }

//     const list = await VideoChunkModel.find({ streamId: sid })
//       .sort({ chunkNumber: 1 })
//       .lean();

//     res.json({
//       streamId: String(sid),
//       count: list.length,
//       chunks: list.map(c => ({ n: c.chunkNumber, file: c.filename })),
//     });
//   } catch (e) {
//     res.status(500).json({ error: e.message });
//   }
// }); // http://192.168.0.13:9000/debug/stream/68fd14590678e75811f131c3

// app.get('/debug/hls/:streamId', async (req, res) => {
//   const { streamId } = req.params;
//   const segs = await HLSSegment.find({ streamId }).sort({ seq: 1 }).lean();
//   res.json({
//     streamId,
//     count: segs.length,
//     segs: segs.map(s => ({ seq: s.seq, file: s.filename, dur: s.duration })),
//   });
// });
