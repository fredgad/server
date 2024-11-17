// const express = require('express');
// const mongoose = require('mongoose');
// const session = require('express-session');
// const bodyParser = require('body-parser');
// const cors = require('cors');

// import session from "session";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
const secretKey = process.env.SECRET_KEY;
const PORT = process.env.PORT || 9000;
const MONGOURL = process.env.MONGO_URL;

const corsOptions = {
  origin: 'http://localhost:4200',
  optionsSuccessStatus: 200,
};

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  tarif: { type: Boolean, required: false },
  image: { type: String, required: false },
  keyId: { type: String, required: false },
});
const userModel = mongoose.model("users", userSchema);

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.listen(PORT, () => {
  console.log(`Listening mongo on ${PORT}`);
});

mongoose.connect(MONGOURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB...')
).catch(err => console.error('Could not connect to MongoDB...', err));

app.post("/register", async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = new userModel({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
    });

    const newUser = await user.save();
    const token = jwt.sign({ userId: newUser._id }, secretKey, { expiresIn: '24h' });

    res.status(201).json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/login", async (req, res) => {
  const user = await userModel.findOne({
    $or: [
      { username: req.body.login },
      { email: req.body.login }
    ]
  });

  if (user && await bcrypt.compare(req.body.password, user.password)) {
    const token = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).send('Неверные учетные данные');
  }
});


// Middleware для верификации токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).send('Токен не предоставлен');

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.status(403).send('Недействительный токен');
    req.user = user;
    next();
  });
};

// Защищенные маршруты
app.get("/getUser", authenticateToken, async (req, res) => {
  try {
    const user = await userModel.findById(req.user.userId).select('-password'); // Исключаем пароль из ответа
    if (!user) return res.status(404).send('Пользователь не найден');

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/getUsers", async (req, res) => {
  const userData = await  userModel.find();
  res.json(userData);
});

app.post("/saveImage", authenticateToken, async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).send('Токен не предоставлен');

  try {
    const decoded = jwt.verify(token, secretKey);
    const userId = decoded.userId;
    const image = req.body.image;

    if (!image) {
      return res.status(400).json({ error: "Image is required" });
    }
    
    const updatedUser = await userModel.findByIdAndUpdate(userId, { image: image }, { new: true });
    if (updatedUser) {
      res.status(200).json({ message: "Image updated successfully" });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(403).json({ error: "Invalid token" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});
