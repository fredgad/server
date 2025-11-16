import { Router } from 'express';
import { streamGridFsFile } from '../utils/gridfs-stream.js';

const router = Router();

router.get('/:filename', async (req, res) => {
  try {
    await streamGridFsFile(req, res, req.params.filename);
  } catch (e) {
    console.error('uploads route error:', e);
    res.sendStatus(500);
  }
});

export default router;
