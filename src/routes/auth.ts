import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import UserModel from '../models/user.model';
import { generateUniqueKeyId } from '../utils/generate-unique-key-id';

const router = express.Router();
const secretKey = process.env.SECRET_KEY as string;

router.post('/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const keyId = await generateUniqueKeyId();

    const user = new UserModel({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      keyId,
    });

    const newUser = await user.save();
    const token = jwt.sign({ userId: newUser._id }, secretKey, { expiresIn: '24h' });

    res.status(201).json({ token });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error occurred' });
    }
  }
});

router.post('/login', async (req, res) => {
  try {
    const user = await UserModel.findOne({
      $or: [{ username: req.body.login }, { email: req.body.login }],
    });

    if (user && (await bcrypt.compare(req.body.password, user.password))) {
      const token = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '24h' });
      res.json({ token });
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error occurred' });
    }
  }
});

export default router;
