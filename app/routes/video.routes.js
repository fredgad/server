import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  getUserVideos,
  getVideoFile,
  deleteUserVideo,
} from '../controllers/video.controller.js';

const router = express.Router();

router.get('/my', authenticateToken, getUserVideos);
router.get('/file/:filename', getVideoFile);
router.post('/delete', authenticateToken, deleteUserVideo);

export default router;
