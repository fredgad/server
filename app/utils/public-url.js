const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

const getHeaderValue = (req, header) => {
  if (!req || typeof req.get !== 'function') return null;
  try {
    return req.get(header);
  } catch {
    return null;
  }
};

export const getPublicBaseUrl = req => {
  const protoSource =
    process.env.PUBLIC_PROTO?.trim() ||
    req?.headers?.['x-forwarded-proto'] ||
    req?.protocol ||
    'http';

  const hostSource =
    process.env.PUBLIC_HOST?.trim() ||
    req?.headers?.['x-forwarded-host'] ||
    getHeaderValue(req, 'host');

  if (!hostSource) return null;
  const host = hostSource.split(',')[0].trim();
  if (!host) return null;

  const proto = protoSource.split(',')[0].trim() || 'http';
  return `${proto}://${host}`;
};

export const toPublicUrl = (req, urlPath) => {
  if (!urlPath || ABSOLUTE_URL_REGEX.test(urlPath)) return urlPath;

  const baseUrl = getPublicBaseUrl(req);
  if (!baseUrl) return urlPath;

  const normalizedPath = urlPath.startsWith('/')
    ? urlPath
    : `/${urlPath.replace(/^\/+/, '')}`;
  return `${baseUrl}${normalizedPath}`;
};
