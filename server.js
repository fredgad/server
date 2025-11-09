import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import connectDB from './app/config/db.js';
import { webpushInit } from './app/config/webpush.js';

import authRoutes from './app/routes/auth.routes.js';
import userRoutes from './app/routes/user.routes.js';
import streamRoutes from './app/routes/stream.routes.js';
import videoRoutes from './app/routes/video.routes.js';
import notificationRoutes from './app/routes/notification.routes.js';
import hooksRoutes from './app/routes/hooks.routes.js';
import uploadsRoutes from './app/routes/uploads.routes.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
console.log(
  '[env loaded] STREAM_WEBHOOK_SECRET:',
  process.env.STREAM_WEBHOOK_SECRET
);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

connectDB();
webpushInit();

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/stream', streamRoutes);
app.use('/video', videoRoutes);
app.use('/notifications', notificationRoutes);
app.use('/hooks', hooksRoutes);
app.use('/uploads', uploadsRoutes);

app.get('/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

const PORT = process.env.PORT || 9000;
server.listen(PORT, '0.0.0.0', () =>
  console.log(`✅ Server running on port ${PORT}`)
);
