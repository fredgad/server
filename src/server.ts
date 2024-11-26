import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;
const MONGOURL = process.env.MONGO_URL as string;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Подключение к базе данных
mongoose
  .connect(MONGOURL)
  .then(() => console.log('Connected to MongoDB.'))
  .catch(err => console.error('Could not connect to MongoDB...', err));

// Подключение маршрутов
app.use('/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
