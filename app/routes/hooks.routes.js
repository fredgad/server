import { Router } from 'express';
import { onPublish, onDone } from '../controllers/hooks.controller.js';

const router = Router();

router.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[hook] ${req.method} ${req.originalUrl}`, {
    ip,
    ua: req.headers['user-agent'],
    q: req.query,
    b: req.body,
  });
  next();
});

router.all('/on_publish', onPublish);
router.all('/on_done', onDone);
router.all('/on_record_done', onDone);

export default router;
