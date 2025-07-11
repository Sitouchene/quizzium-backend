// src/config/env.ts
import dotenv from 'dotenv';
dotenv.config();

interface EnvConfig {
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  ADMIN_PASSWORD?: string; // Optionnel si vous ne l'utilisez que pour le seed
  MANAGER_PASSWORD?: string;
  TEACHER_PASSWORD?: string;
  STUDENT_PASSWORD?: string;
}

const getEnv = (): EnvConfig => {
  const PORT = parseInt(process.env.PORT || '5000', 10);
  const MONGODB_URI = process.env.MONGODB_URI;
  const JWT_SECRET = process.env.JWT_SECRET;
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

  if (!MONGODB_URI) {
    console.error("Missing MONGODB_URI in .env file.");
    process.exit(1);
  }
  if (!JWT_SECRET) {
    console.error("Missing JWT_SECRET in .env file. Please set a strong secret.");
    process.exit(1);
  }
  return {
    PORT,
    MONGODB_URI,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    MANAGER_PASSWORD: process.env.MANAGER_PASSWORD,
    TEACHER_PASSWORD: process.env.TEACHER_PASSWORD,
    STUDENT_PASSWORD: process.env.STUDENT_PASSWORD,
  };
};

export const config = getEnv();