import { Router } from 'express';
import { onPublish, onDone } from '../controllers/hooks.controller.js';

const router = Router();
router.get('/on_publish', onPublish);
router.get('/on_done', onDone);
export default router;
