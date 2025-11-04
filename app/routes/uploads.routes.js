import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const db = mongoose.connection.db;
    const file = await db.collection('uploads.files').findOne({ filename });
    if (!file) return res.status(404).send('Not found');

    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'uploads',
    });
    res.set('Content-Type', file.contentType || 'video/mp4');
    res.set('Cache-Control', 'no-cache');

    bucket
      .openDownloadStreamByName(filename)
      .on('error', () => res.sendStatus(404))
      .pipe(res);
  } catch (e) {
    console.error('uploads route error:', e);
    res.sendStatus(500);
  }
});

export default router;
