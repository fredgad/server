// import session from "session";
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import grid from 'gridfs-stream';
import { GridFsStorage } from 'multer-gridfs-storage';
import multer from 'multer';

import userModel from './app/models/user.model.js';
import { generateUniqueKeyId } from './app/utils/generate-unique-key-id.js';

dotenv.config();

const app = express();
const secretKey = process.env.SECRET_KEY;
const PORT = process.env.PORT || 9000;
const MONGOURL = process.env.MONGO_URL;

const corsOptions = {
  origin: 'http://localhost:4200',
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// MongoDB and GridFS Configuration
let gfs, gridfsBucket;

mongoose
  .connect(MONGOURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB.');

    gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads',
    });

    gfs = grid(mongoose.connection.db, mongoose.mongo);
    gfs.collection('uploads');
  })
  .catch(err => console.error('Could not connect to MongoDB...', err));

// Multer Storage Configuration for GridFS
const storage = new GridFsStorage({
  url: MONGOURL,
  options: { useUnifiedTopology: true },
  file: (req, file) => {
    console.log('Обрабатываем файл:', file);
    return new Promise((resolve, reject) => {
      const fileInfo = {
        bucketName: 'uploads',
        filename: `${Date.now()}-${file.originalname}`,
        // metadata: {
        //   user_id: req.user._id,
        // },
      };
      resolve(fileInfo);
    });
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
}).single('file');

app.listen(PORT, () => {
  console.log(`Listening mongo on ${PORT}`);
});

app.post('/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const keyId = await generateUniqueKeyId();

    const user = new userModel({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      keyId,
    });

    const newUser = await user.save();
    const token = jwt.sign({ userId: newUser._id }, secretKey, { expiresIn: '24h' });

    res.status(201).json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/login', async (req, res) => {
  const user = await userModel.findOne({
    $or: [{ username: req.body.login }, { email: req.body.login }],
  });

  if (user && (await bcrypt.compare(req.body.password, user.password))) {
    const token = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).send('Неверные учетные данные');
  }
});

// Middleware для верификации токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).send('Токен не предоставлен');

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.status(403).send('Недействительный токен');
    req.user = user;
    next();
  });
};

// Защищенные маршруты
app.get('/getUser', authenticateToken, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId).select('-password'); // Исключаем пароль из ответа
    if (!user) return res.status(404).send('Пользователь не найден');

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/getTrustedUsersByKeyIds', authenticateToken, async (req, res) => {
  try {
    const { keyIds } = req.body;

    if (!keyIds || !Array.isArray(keyIds) || keyIds.length === 0) {
      return res.status(400).json({ error: 'keyIds array is required' });
    }

    const users = await userModel.find({ keyId: { $in: keyIds } }, { username: 1, email: 1, keyId: 1, image: 1, videos: 1 });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/saveImage', authenticateToken, async (req, res) => {
  console.log('Image file uploaded');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).send('Токен не предоставлен');

  try {
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.userId;
    const image = req.body.image;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const updatedUser = await userModel.findByIdAndUpdate(userId, { image: image }, { new: true });
    if (updatedUser) {
      res.status(200).json({ message: 'Image updated successfully' });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.post('/addUserByKeyId', authenticateToken, async (req, res) => {
  try {
    const decoded = jwt.verify(req.headers['authorization'].split(' ')[1], secretKey);
    const requesterId = decoded.userId;
    const targetKeyId = req.body.keyId;

    if (!targetKeyId) {
      return res.status(400).json({ error: 'keyId is required' });
    }

    const requester = await userModel.findById(requesterId);
    if (!requester) {
      return res.status(404).json({ error: 'Requester not found' });
    }

    if (requester.keyId === targetKeyId) {
      return res.status(400).json({ error: 'You cannot send a request to yourself' });
    }

    const targetUser = await userModel.findOne({ keyId: targetKeyId });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const isAlreadyTrusted = requester.trustedPeople.some(person => person.keyId === targetKeyId);
    if (isAlreadyTrusted) {
      return res.status(400).json({ error: 'User is already in your trusted list' });
    }

    if (requester.outgoingReq.includes(targetKeyId)) {
      return res.status(400).json({ error: 'Request already sent to this user' });
    }
    if (targetUser.incomingReq.includes(requester.keyId)) {
      return res.status(400).json({ error: 'Request already received from this user' });
    }

    requester.outgoingReq.push(targetKeyId);
    targetUser.incomingReq.push(requester.keyId);

    await requester.save();
    await targetUser.save();

    res.status(200).json({ message: 'Request sent successfully' });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.post('/cancelRequest', authenticateToken, async (req, res) => {
  try {
    const decoded = jwt.verify(req.headers['authorization'].split(' ')[1], secretKey);
    const currentUserKeyId = decoded.userId;
    const targetKeyId = req.body.keyId;

    if (!targetKeyId) {
      return res.status(400).json({ error: 'keyId is required' });
    }

    const currentUser = await userModel.findById(currentUserKeyId);
    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    const targetUser = await userModel.findOne({ keyId: targetKeyId });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    currentUser.incomingReq = currentUser.incomingReq.filter(id => id !== targetKeyId);

    targetUser.outgoingReq = targetUser.outgoingReq.filter(id => id !== currentUser.keyId);

    currentUser.outgoingReq = currentUser.outgoingReq.filter(id => id !== targetKeyId);

    targetUser.incomingReq = targetUser.incomingReq.filter(id => id !== currentUser.keyId);

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({ message: 'Request canceled successfully' });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.post('/acceptTrustedUser', authenticateToken, async (req, res) => {
  try {
    const decoded = jwt.verify(req.headers['authorization'].split(' ')[1], secretKey);
    const currentUserKeyId = decoded.userId;
    const targetKeyId = req.body.keyId;

    if (!targetKeyId) {
      return res.status(400).json({ error: 'keyId is required' });
    }

    const currentUser = await userModel.findById(currentUserKeyId);
    if (!currentUser) {
      return res.status(404).json({ error: 'Current user not found' });
    }

    const targetUser = await userModel.findOne({ keyId: targetKeyId });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    currentUser.incomingReq = currentUser.incomingReq.filter(id => id !== targetKeyId);
    currentUser.outgoingReq = currentUser.outgoingReq.filter(id => id !== targetKeyId);

    targetUser.incomingReq = targetUser.incomingReq.filter(id => id !== currentUser.keyId);
    targetUser.outgoingReq = targetUser.outgoingReq.filter(id => id !== currentUser.keyId);

    if (!currentUser.trustedPeople) currentUser.trustedPeople = [];
    if (!targetUser.trustedPeople) targetUser.trustedPeople = [];

    if (!currentUser.trustedPeople.some(person => person.keyId === targetKeyId)) {
      currentUser.trustedPeople.push({ keyId: targetKeyId, displayed: true });
    }
    if (!targetUser.trustedPeople.some(person => person.keyId === currentUser.keyId)) {
      targetUser.trustedPeople.push({ keyId: currentUser.keyId, displayed: true });
    }

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({ message: 'User added to trusted list successfully' });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.post('/removeTrustedUser', authenticateToken, async (req, res) => {
  try {
    const decoded = jwt.verify(req.headers['authorization'].split(' ')[1], secretKey);
    const requesterId = decoded.userId;
    const targetKeyId = req.body.keyId;

    if (!targetKeyId) {
      return res.status(400).json({ error: 'keyId is required' });
    }

    const requester = await userModel.findById(requesterId);
    if (!requester) {
      return res.status(404).json({ error: 'Requester not found' });
    }

    const targetUser = await userModel.findOne({ keyId: targetKeyId });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    requester.trustedPeople = requester.trustedPeople.filter(person => person.keyId !== targetKeyId);

    targetUser.trustedPeople = targetUser.trustedPeople.filter(person => person.keyId !== requester.keyId);

    await requester.save();
    await targetUser.save();

    res.status(200).json({ message: 'Trusted user removed successfully' });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: 'Invalid token' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Upload Video Route
// upload.single('videoFile'),
app.post('/uploadVideo', authenticateToken, upload, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Логирование метаданных загруженного файла
    console.log('Загруженный файл:', req.file);

    // Генерация URL для доступа к файлу через GridFS
    // const fileUrl = `/uploads/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const video = {
      url: fullUrl,
      createdAt: Date.now(),
    };

    const userId = req.user.userId;
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Логируем видео, которое добавляется в массив videos
    console.log('Saving video to user:', video);

    user.videos.push(video);
    await user.save();

    res.status(200).json({ message: 'Видео успешно загружено', video });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/uploads/:filename', async (req, res) => {
  try {
    const file = await gfs.files.findOne({ filename: req.params.filename });

    if (!file || file.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const mimeType = file.contentType;
    res.set('Content-Type', mimeType);

    const readStream = gridfsBucket.openDownloadStreamByName(req.params.filename);
    readStream.pipe(res);
  } catch (error) {
    console.error('Error retrieving file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/getUserVideos', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ videos: user.videos });
  } catch (error) {
    console.error('Error retrieving user videos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
