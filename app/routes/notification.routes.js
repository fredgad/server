import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  getNotifications,
  markRead,
} from '../controllers/notification.controller.js';

const router = express.Router();

router.get('/', authenticateToken, getNotifications);
router.post('/markRead', authenticateToken, markRead);

export default router;
