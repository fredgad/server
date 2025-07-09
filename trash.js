// io.on('connection', socket => {
//   console.log('User connected');

//   socket.on('disconnect', () => {
//     console.log('User disconnected');
//   });
// });

// app.post('/startHlsStream', authenticateToken, (req, res) => {
//   // Пример: ffmpeg читает входной поток из req
//   // (В реальности нужно убедиться, что клиент действительно шлёт бинарный стрим)

//   const command = ffmpeg(req)
//     .inputOptions(['-re'])          // указываем, что поток поступает в real-time
//     .videoCodec('libx264')
//     .audioCodec('aac')
//     .format('hls')
//     .outputOptions([
//       '-hls_time 1',                // длина каждого .ts-сегмента (1 сек)
//       '-hls_list_size 10',          // количество сегментов в .m3u8
//       '-hls_flags delete_segments',  // старые сегменты удаляем (чтобы не копились)
//       '-hls_segment_filename', path.join(HLS_FOLDER, 'segment_%03d.ts'),
//     ])
//     .on('start', cmd => {
//       console.log('ffmpeg started: ', cmd);
//     })
//     .on('error', err => {
//       console.error('ffmpeg error:', err);
//       // Можно отправить пользователю ошибку
//       res.status(500).end('FFmpeg error');
//     })
//     .on('end', () => {
//       console.log('ffmpeg ended');
//       // Когда ffmpeg завершится
//       res.end();
//     })
//     .save(path.join(HLS_FOLDER, 'index.m3u8'));

//   // При желании можно отправить ответ сразу,
//   // если не хотим ждать завершения ffmpeg
//   res.status(200).json({ message: 'HLS stream started' });
// });
