// src/controllers/publicQuizController.ts
import { Request, Response, NextFunction } from 'express';
import {
  getPublicQuizzesService,
  getPublicQuizByIdService,
  getPublicQuizBySlugService
} from '../services/quizService'; // Importe les nouvelles fonctions du service
import { ApiError } from '../utils/types';
import { Types } from 'mongoose';

/**
 * Récupère tous les quizzes publics et publiés.
 * GET /api/public/quizzes
 * Query params: page, limit
 */
export const getAllPublicQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit } = req.query;

    const options = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    };

    const quizzes = await getPublicQuizzesService(options);
    res.status(200).json(quizzes);
  } catch (error) {
    next(error);
  }
};

/**
 * Récupère un quiz public et publié spécifique par ID.
 * GET /api/public/quizzes/:id
 */
export const getPublicQuizById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid quiz ID format.', 400));
    }

    const quiz = await getPublicQuizByIdService(id);
    res.status(200).json(quiz);
  } catch (error) {
    next(error);
  }
};


/**
 * GET /api/public/quizzes/:slug
 * Récupère un quiz par slug, avec une limite de questions via query param.
 */
export const getPublicQuizBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    // Récupère le paramètre 'limit' de la query string et le convertit en nombre
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const quiz = await getPublicQuizBySlugService(slug, limit);
    res.status(200).json(quiz);
  } catch (error) {
    next(error);
  }
};