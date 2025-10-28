import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
  getUser,
  getTrustedUsersByKeyIds,
  saveImage,
  addUserByKeyId,
  acceptTrustedUser,
  removeTrustedUser,
} from '../controllers/user.controller.js';

const router = express.Router();

router.get('/me', authenticateToken, getUser);
router.post('/trusted', authenticateToken, getTrustedUsersByKeyIds);
router.post('/saveImage', authenticateToken, saveImage);
router.post('/addUser', authenticateToken, addUserByKeyId);
router.post('/acceptUser', authenticateToken, acceptTrustedUser);
router.post('/removeUser', authenticateToken, removeTrustedUser);

export default router;
