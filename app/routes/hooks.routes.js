import { Router } from 'express';
import { onPublish, onDone } from '../controllers/hooks.controller.js';

const router = Router();

// принимаем и POST, и GET для надёжности
router.all('/on_publish', onPublish);
router.all('/on_done', onDone);
router.all('/on_record_done', onDone);

export default router;
