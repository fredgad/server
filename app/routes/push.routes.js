import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { registerToken, sendTestPush } from '../controllers/push.controller.js';

const router = express.Router();

router.post('/register', authenticateToken, registerToken);
router.post('/test', authenticateToken, sendTestPush);

export default router;
