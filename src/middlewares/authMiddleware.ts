// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UserRole, ApiError } from '../utils/types';


export const protect = (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = verifyToken(token);
      req.user = { id: decoded.id, role: decoded.role };
      return next(); // ✅ return ajouté ici
    } catch (error) {
      console.error('Token verification failed:', error);
      return next(new ApiError('Not authorized, token failed', 401)); // ✅ return
    }
  }

  // Si pas de token
  return next(new ApiError('Not authorized, no token', 401)); // ✅ return ajouté ici
};
