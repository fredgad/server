import mongoose from 'mongoose';
import grid from 'gridfs-stream';
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';
import dotenv from 'dotenv';

dotenv.config();

const MONGOURL = process.env.MONGO_URL;

// Подключение к MongoDB
const conn = mongoose.createConnection(MONGOURL, { useNewUrlParser: true, useUnifiedTopology: true });

// Инициализация GridFS
let gfs, gridfsBucket;
conn.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, { bucketName: 'videos' });
  gfs = grid(conn.db, mongoose.mongo);
  gfs.collection('videos');
});

// Настройка Multer-GridFS-Storage
const storage = new GridFsStorage({
  url: MONGOURL,
  options: { useUnifiedTopology: true },
  file: (req, file) => {
    return {
      bucketName: 'videos', // Имя коллекции
      filename: `${Date.now()}-${file.originalname}`, // Имя файла
    };
  },
});

const upload = multer({ storage });





app.post('/uploadVideo', upload.single('video'), async (req, res) => {
    try {
      res.status(201).json({
        message: 'Video uploaded successfully',
        file: req.file,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  


  app.get('/videos', async (req, res) => {
    try {
      const files = await gfs.files.find().toArray();
      if (!files || files.length === 0) {
        return res.status(404).json({ message: 'No videos found' });
      }
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

  app.get('/videos/:filename', async (req, res) => {
    try {
      const file = await gfs.files.findOne({ filename: req.params.filename });
      if (!file) {
        return res.status(404).json({ message: 'Video not found' });
      }
  
      const readStream = gridfsBucket.openDownloadStreamByName(file.filename);
      res.set('Content-Type', file.contentType);
      readStream.pipe(res);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

  app.post('/uploadVideo', authenticateToken, upload.single('video'), async (req, res) => {
    try {
      const decoded = jwt.verify(req.headers['authorization'].split(' ')[1], secretKey);
      const userId = decoded.userId;
  
      const user = await UserModel.findById(userId);
      if (!user) return res.status(404).send('User not found');
  
      user.videos.push({ filename: req.file.filename });
      await user.save();
  
      res.status(201).json({
        message: 'Video uploaded and linked to user',
        file: req.file,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  