import mongoose from 'mongoose';
import logger from '../utils/logger';

const MONGO_URI = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');
  return uri;
};

let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReconnect(attempt = 1) {
  if (reconnectTimer) return; // already scheduled
  const delay = Math.min(1000 * 2 ** attempt, 30000); // 2s, 4s, 8s … max 30s
  logger.warn(`MongoDB reconnecting in ${delay / 1000}s (attempt ${attempt})…`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await mongoose.connect(MONGO_URI(), { autoIndex: true });
      logger.info('MongoDB reconnected successfully');
    } catch (err) {
      logger.error('MongoDB reconnect failed:', err);
      scheduleReconnect(attempt + 1);
    }
  }, delay);
}

const connectDB = async (): Promise<void> => {
  await mongoose.connect(MONGO_URI(), {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  logger.info('MongoDB connected successfully');

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
    scheduleReconnect();
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  });
};

export default connectDB;
