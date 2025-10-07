// src/app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import apiRoutes from './routes/index.js';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import morgan from 'morgan';

const cliente = process.env.CORS || 'http://192.168.1.83:5173';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(morgan('dev'));

// Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors({
  origin: [cliente],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// archivo para los vouchers
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(apiRoutes);

// obtener API
app.get('/api', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// errores
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : error.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
