import { Router } from 'express';
import { onPublish, onDone } from '../controllers/hooks.controller.js';

const router = Router();

router.all('/on_publish', onPublish);
router.all('/on_done', onDone);
router.all('/on_record_done', onDone);

export default router;
