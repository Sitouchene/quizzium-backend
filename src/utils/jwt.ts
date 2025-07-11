// src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { UserRole } from './types';

export const generateToken = (id: string, role: UserRole): string => {
  return jwt.sign({ id, role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
};

export const verifyToken = (token: string): { id: string; role: UserRole } => {
  return jwt.verify(token, config.JWT_SECRET) as { id: string; role: UserRole };
};