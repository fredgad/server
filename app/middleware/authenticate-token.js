import jwt from 'jsonwebtoken';

const secretKey = process.env.SECRET_KEY;

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).send('Токен не предоставлен');

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.status(403).send('Недействительный токен');
    req.user = user;
    next();
  });
};
