// src/utils/password.ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10; // Nombre de rounds pour le salage bcrypt

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};