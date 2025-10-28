import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import userModel from '../models/user.model.js';
import { generateUniqueKeyId } from '../utils/generate-unique-key-id.js';

export const register = async (req, res) => {
  try {
    const hashed = await bcrypt.hash(req.body.password, 10);
    const keyId = await generateUniqueKeyId();
    const user = await userModel.create({
      username: req.body.username,
      email: req.body.email,
      password: hashed,
      keyId,
    });

    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
      expiresIn: '24h',
    });

    res.status(201).json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const login = async (req, res) => {
  const { login, password } = req.body;
  const user = await userModel.findOne({
    $or: [{ username: login }, { email: login }],
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });

  const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
    expiresIn: '24h',
  });
  res.json({ token });
};
