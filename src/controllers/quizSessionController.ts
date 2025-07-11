// src/controllers/quizSessionController.ts
import { Request, Response, NextFunction } from 'express';
import {
  startQuizSessionService,
  submitQuizSessionService,
  getAllQuizSessionsService,
  getQuizSessionByIdService,
  deleteQuizSessionService,
} from '../services/quizSessionService';
// Importe les enums nécessaires depuis utils/types.ts
import { ApiError, AvailableLanguage, UserRole } from '../utils/types'; 
import { Types } from 'mongoose';

/**
 * Start a new quiz session (Student only).
 * POST /api/quiz-sessions/start
 * Body: { quizId, language }
 */
export const startQuizSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { quizId, language } = req.body;
    const userId = req.user?.id; // Récupère l'ID de l'utilisateur authentifié

    if (!userId) {
      return next(new ApiError('Authentication required to start a quiz session.', 401));
    }
    // Assurez-vous que seul un étudiant peut démarrer une session de quiz
    if (req.user?.role !== UserRole.STUDENT) {
      return next(new ApiError('Only students can start quiz sessions.', 403));
    }

    if (!quizId || !Types.ObjectId.isValid(quizId)) {
      return next(new ApiError('Valid quiz ID is required.', 400));
    }
    // Valide que la langue fournie est une valeur valide de l'enum AvailableLanguage
    if (!language || !Object.values(AvailableLanguage).includes(language as AvailableLanguage)) {
      return next(new ApiError(`Invalid language provided. Must be one of: ${Object.values(AvailableLanguage).join(', ')}.`, 400));
    }

    const newSession = await startQuizSessionService({
      user: userId, // Utilise l'ID de l'utilisateur authentifié
      quizId,
      language: language as AvailableLanguage, // Cast pour s'assurer du type enum
    });
    res.status(201).json(newSession);
  } catch (error) {
    next(error);
  }
};

/**
 * Submit and complete a quiz session (Student only).
 * PUT /api/quiz-sessions/:id/submit
 * Body: { responses: [], durationSeconds }
 */
export const submitQuizSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // Session ID
    const { responses, durationSeconds } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return next(new ApiError('Authentication required to submit a quiz session.', 401));
    }
    // Seuls les étudiants peuvent soumettre un quiz.
    if (req.user?.role !== UserRole.STUDENT) { // Utilisation de la valeur de l'enum UserRole
      return next(new ApiError('Only students can submit quiz sessions.', 403));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid quiz session ID format.', 400));
    }
    if (!Array.isArray(responses) || responses.length === 0 || typeof durationSeconds !== 'number') {
      return next(new ApiError('Valid responses array and durationSeconds are required.', 400));
    }

    const completedSession = await submitQuizSessionService(id, { responses, durationSeconds }, userId);
    res.status(200).json(completedSession);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all quiz sessions.
 * GET /api/quiz-sessions
 * Query params: user, quiz, isCompleted, page, limit, populateUser, populateQuiz, populateQuestions
 */
export const getAllQuizSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user, quiz, isCompleted, page, limit, populateUser, populateQuiz, populateQuestions } = req.query;
    const requestingUser = req.user;

    if (!requestingUser?.id) { // Assurez-vous que req.user est défini pour passer à getAllQuizSessionsService
      return next(new ApiError('Authentication required to retrieve quiz sessions.', 401));
    }

    const filters: any = {};
    if (user) filters.user = user;
    if (quiz) filters.quiz = quiz;
    if (isCompleted !== undefined) filters.isCompleted = isCompleted === 'true'; // Convert string to boolean

    const options = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      populateUser: populateUser === 'true',
      populateQuiz: populateQuiz === 'true',
      populateQuestions: populateQuestions === 'true',
    };

    const sessions = await getAllQuizSessionsService(filters, options, requestingUser);
    res.status(200).json(sessions);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single quiz session by ID.
 * GET /api/quiz-sessions/:id
 * Query params: populateUser, populateQuiz, populateQuestions
 */
export const getQuizSessionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { populateUser, populateQuiz, populateQuestions } = req.query;
    const requestingUser = req.user;

    if (!requestingUser?.id) { // Assurez-vous que req.user est défini pour passer à getQuizSessionByIdService
      return next(new ApiError('Authentication required to retrieve a quiz session.', 401));
    }
    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid quiz session ID format.', 400));
    }

    const options = {
      populateUser: populateUser === 'true',
      populateQuiz: populateQuiz === 'true',
      populateQuestions: populateQuestions === 'true',
    };

    const session = await getQuizSessionByIdService(id, options, requestingUser);
    res.status(200).json(session);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a quiz session (Admin/Manager can delete any; Student can delete their own incomplete sessions).
 * DELETE /api/quiz-sessions/:id
 */
export const deleteQuizSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;

    if (!requestingUser?.id) {
      return next(new ApiError('Authentication required to delete a quiz session.', 401));
    }
    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid quiz session ID format.', 400));
    }

    const result = await deleteQuizSessionService(id, requestingUser);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
