import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const secretKey = process.env.SECRET_KEY as string;

export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).send('Token not provided');
    return;
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      res.status(403).send('Invalid token');
      return;
    }

    req.user = user;
    next();
  });
};
