// Lightweight request logger to debug API calls (method, path, status, duration, userId, safe body preview).
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  // Prepare a compact body preview (avoid dumping large base64 strings).
  let bodyPreview = {};
  try {
    const entries = Object.entries(req.body || {});
    bodyPreview = entries.reduce((acc, [key, value]) => {
      if (typeof value === 'string') {
        const max = 120;
        acc[key] =
          value.length > max
            ? `${value.slice(0, max)}…(${value.length})`
            : value;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
  } catch {
    bodyPreview = '[unserializable-body]';
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const userId = req.user?.userId ?? 'anon';
    console.log(
      `[REQ] ${method} ${originalUrl} ${res.statusCode} ${duration}ms user=${userId} body=${JSON.stringify(
        bodyPreview
      )}`
    );
  });

  next();
};
