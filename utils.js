// получить метаданные (длительность) файла из GridFS
async function probeGridFsMp4DurationSeconds(filename) {
  return new Promise((resolve, reject) => {
    const rs = gridfsBucket.openDownloadStreamByName(filename);
    const tmpPath = `/tmp/${filename}-${Date.now()}.mp4`;
    // Сливаем во временный файл (проще для ffprobe)
    import('node:fs').then(fs => {
      const ws = fs.createWriteStream(tmpPath);
      rs.pipe(ws);
      ws.on('finish', () => {
        ffmpeg.ffprobe(tmpPath, (err, data) => {
          fs.unlink(tmpPath, () => {});
          if (err) return resolve(null);
          const dur = data?.format?.duration;
          resolve(typeof dur === 'number' ? dur : null);
        });
      });
      ws.on('error', reject);
    });
  });
}

// трансмульс mp4 (GridFS) -> .ts (GridFS) без перекодирования
async function transmuxMp4ToTsGridFS(inFilename, outFilename) {
  return new Promise(async (resolve, reject) => {
    const rs = gridfsBucket.openDownloadStreamByName(inFilename);
    const passThrough = (await import('stream')).PassThrough;
    const input = new passThrough();
    rs.pipe(input);

    // Pipe ffmpeg output обратно в GridFS
    const uploadStream = gridfsBucket.openUploadStream(outFilename, {
      contentType: 'video/MP2T',
      metadata: { source: inFilename, transmux: 'copy' },
    });

    ffmpeg(input)
      .videoCodec('copy')
      .audioCodec('copy')
      .format('mpegts')
      .on('error', reject)
      .on('end', () => resolve())
      .pipe(uploadStream, { end: true });
  });
}
