// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/types';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  let statusCode = err instanceof ApiError ? err.statusCode : 500;
  let message = err.message || 'Internal Server Error';

  // Cas spécifique pour les erreurs de validation Mongoose ou autres
  if (err.name === 'CastError' && (err as any).kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Autres cas d'erreurs (ex: erreurs de validation Joi/Express-validator)
  // if (err.name === 'ValidationError') { ... }

  res.status(statusCode).json({
    message: message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack, // Ne pas exposer le stack en production
  });
};