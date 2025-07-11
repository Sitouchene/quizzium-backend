// src/controllers/questionController.ts
import { Request, Response, NextFunction } from 'express';
import {
  createQuestionService,
  getAllQuestionsService,
  getQuestionByIdService,
  updateQuestionService,
  deleteQuestionService,
} from '../services/questionService';
// Importe les enums nécessaires depuis utils/types.ts
import { ApiError, UserRole } from '../utils/types'; 
import { Types } from 'mongoose';

/**
 * Create a new question (Manager/Admin/Teacher only).
 * POST /api/questions
 * Body includes: { chapter, text, mediaType?, mediaUrl?, mediaAltText?, type, choices?, correctAnswerFormula?, explanation?, difficulty, tags? }
 */
export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chapter, text, mediaType, mediaUrl, mediaAltText, type, choices, correctAnswerFormula, explanation, difficulty, tags } = req.body;

    // Vérification d'authentification et d'autorisation
    if (!req.user?.id) {
      return next(new ApiError('Authentication required to create a question.', 401));
    }
    // Seuls les managers, admins ou enseignants peuvent créer des questions
    if (![UserRole.MANAGER, UserRole.ADMIN, UserRole.TEACHER].includes(req.user.role)) {
      return next(new ApiError('Only managers, admins or teachers can create questions.', 403));
    }

    const newQuestion = await createQuestionService({
      chapter, text, mediaType, mediaUrl, mediaAltText, type, choices, correctAnswerFormula, explanation, difficulty, tags
    });
    res.status(201).json(newQuestion);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all questions (Accessible by all authenticated roles).
 * GET /api/questions
 * GET /api/chapters/:chapterId/questions (nested route)
 * Supports filtering by chapter ID, pagination. Excludes answers for students by default.
 */
export const getAllQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chapterId } = req.params; // From nested route if applicable
    const { page, limit, includeAnswers } = req.query;

    // Vérification d'authentification
    if (!req.user?.id) {
      return next(new ApiError('Authentication required to retrieve questions.', 401));
    }

    // Déterminer si les réponses doivent être incluses en fonction du rôle de l'utilisateur ou du paramètre de requête explicite
    // Les managers, admins et teachers peuvent toujours voir les réponses
    const includeAnswersForUser = [UserRole.MANAGER, UserRole.ADMIN, UserRole.TEACHER].includes(req.user.role) || includeAnswers === 'true';

    const options = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      includeAnswers: includeAnswersForUser,
    };

    const questions = await getAllQuestionsService(chapterId, options);
    res.status(200).json(questions);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single question by ID (Accessible by all authenticated roles).
 * GET /api/questions/:id
 * Excludes answers for students by default.
 */
export const getQuestionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { includeAnswers } = req.query;

    // Vérification d'authentification
    if (!req.user?.id) {
      return next(new ApiError('Authentication required to retrieve a question.', 401));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid question ID format.', 400));
    }

    // Déterminer si les réponses doivent être incluses en fonction du rôle de l'utilisateur ou du paramètre de requête explicite
    // Les managers, admins et teachers peuvent toujours voir les réponses
    const includeAnswersForUser = [UserRole.MANAGER, UserRole.ADMIN, UserRole.TEACHER].includes(req.user.role) || includeAnswers === 'true';

    const options = {
      includeAnswers: includeAnswersForUser,
    };

    const question = await getQuestionByIdService(id, options);
    res.status(200).json(question);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a question (Manager/Admin/Teacher only).
 * PUT /api/questions/:id
 * Body includes: { text?, mediaType?, mediaUrl?, mediaAltText?, type?, choices?, correctAnswerFormula?, explanation?, difficulty?, tags? }
 */
export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body; // req.body contient tous les champs à mettre à jour, y compris les médias

    // Vérification d'authentification et d'autorisation
    if (!req.user?.id) {
      return next(new ApiError('Authentication required to update a question.', 401));
    }
    // Seuls les managers, admins ou enseignants peuvent mettre à jour des questions
    if (![UserRole.MANAGER, UserRole.ADMIN, UserRole.TEACHER].includes(req.user.role)) {
      return next(new ApiError('Only managers, admins or teachers can update questions.', 403));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid question ID format.', 400));
    }
    if (Object.keys(updateData).length === 0) {
      return next(new ApiError('No update data provided.', 400));
    }

    const updatedQuestion = await updateQuestionService(id, updateData);
    res.status(200).json(updatedQuestion);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a question (Manager/Admin/Teacher only).
 * DELETE /api/questions/:id
 */
export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Vérification d'authentification et d'autorisation
    if (!req.user?.id) {
      return next(new ApiError('Authentication required to delete a question.', 401));
    }
    // Seuls les managers, admins ou enseignants peuvent supprimer des questions
    if (![UserRole.MANAGER, UserRole.ADMIN, UserRole.TEACHER].includes(req.user.role)) {
      return next(new ApiError('Only managers, admins or teachers can delete questions.', 403));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid question ID format.', 400));
    }

    const result = await deleteQuestionService(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
