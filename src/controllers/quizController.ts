// src/controllers/quizController.ts
import { Request, Response, NextFunction } from 'express';
import {
  createQuizService,
  updateQuizService,
  publishQuizService,
  getAllQuizzesService,
  getQuizByIdService,
  deleteQuizService,
} from '../services/quizService';
// Importe les enums nécessaires depuis utils/types.ts
import { ApiError, UserRole, QuizType } from '../utils/types'; 
import { Types } from 'mongoose';


/**
 * Crée un nouveau quiz.
 * POST /api/quizzes
 * Corps: { trainingId, title, description, quizType, deadline, durationMinutes, globalScore, allowedAttempts, tags, questionsConfig }
 */
export const createQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      trainingId,
      title,
      description,
      quizType, // Ceci est déjà de type QuizType (enum)
      deadline,
      slug,
      durationMinutes,
      globalScore,
      allowedAttempts,
      tags,
      questionsConfig
    } = req.body;

    if (!req.user?.id) {
      return next(new ApiError('Authentication required to create a quiz.', 401));
    }
    if (!trainingId || !title || !quizType || globalScore === undefined) {
      return next(new ApiError('Training ID, title, quiz type, and global score are required.', 400));
    }
    if (!questionsConfig || (!questionsConfig.selectedQuestionIdsWithScores && !questionsConfig.numberOfQuestions)) {
      return next(new ApiError('Question configuration (selected questions or generation parameters) is required.', 400));
    }

    // Role-based validation for quizType
    // Utilisation des valeurs de l'enum UserRole et QuizType
    if (req.user.role === UserRole.STUDENT && quizType !== QuizType.REVISION) {
      return next(new ApiError('Students can only create revision quizzes.', 403));
    }
    if (req.user.role === UserRole.TEACHER && quizType === QuizType.REVISION) {
      // Teachers cannot create revision quizzes directly, as revision quizzes are student-specific.
      // This ensures business logic: students create revisions for themselves.
      return next(new ApiError('Teachers cannot create revision quizzes directly.', 403));
    }
    // Seulement les enseignants, admins ou managers peuvent créer des quiz de type FORMATIVE/SUMMATIVE
    if (![UserRole.TEACHER, UserRole.ADMIN, UserRole.MANAGER].includes(req.user.role) && quizType !== QuizType.REVISION) {
      return next(new ApiError('Only teachers, admins or managers can create formative/summative quizzes.', 403));
    }


    const newQuiz = await createQuizService({
      trainingId,
      title,
      slug,
      description,
      creatorId: req.user.id,
      quizType, // Déjà de type enum
      deadline,
      durationMinutes,
      globalScore,
      allowedAttempts,
      tags,
      questionsConfig,
    });

    res.status(201).json(newQuiz);
  } catch (error) {
    next(error);
  }
};

/**
 * Met à jour un quiz existant.
 * PUT /api/quizzes/:id
 * Corps: { title?, description?, deadline?, durationMinutes?, globalScore?, allowedAttempts?, tags?, questions? }
 */
export const updateQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, description, deadline, durationMinutes, globalScore, allowedAttempts, tags, questions } = req.body;

    if (!req.user?.id) {
      return next(new ApiError('Authentication required to update a quiz.', 401));
    }
    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid quiz ID format.', 400));
    }

    const updatedQuiz = await updateQuizService(id, {
      title,
      description,
      deadline,
      durationMinutes,
      globalScore,
      allowedAttempts,
      tags,
      questions, // This should be an array of {questionId, score}
    }, req.user);

    res.status(200).json(updatedQuiz);
  } catch (error) {
    next(error);
  }
};

/**
 * Publie ou dépublie un quiz.
 * PATCH /api/quizzes/:id/publish
 * Corps: { isPublished: boolean }
 */
export const publishQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;

    if (!req.user?.id) {
      return next(new ApiError('Authentication required.', 401));
    }
    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid quiz ID format.', 400));
    }
    if (typeof isPublished !== 'boolean') {
      return next(new ApiError('Publication status (isPublished) must be a boolean.', 400));
    }

    const updatedQuiz = await publishQuizService(id, isPublished, req.user);
    res.status(200).json(updatedQuiz);
  } catch (error) {
    next(error);
  }
};


/**
 * Récupère tous les quizzes.
 * GET /api/quizzes
 * Query params: training, creator, quizType, isPublished, page, limit, populateCreator, populateTraining
 */
export const getAllQuizzes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { training, creator, quizType, isPublished, page, limit, populateCreator, populateTraining } = req.query;

    const filters: any = {};
    if (training) filters.training = training;
    if (creator) filters.creator = creator;
    // Utilisation de QuizType enum pour le filtre
    if (quizType && Object.values(QuizType).includes(quizType as QuizType)) {
      filters.quizType = quizType;
    } else if (quizType) {
      return next(new ApiError(`Invalid quizType filter. Must be one of: ${Object.values(QuizType).join(', ')}.`, 400));
    }
    if (isPublished !== undefined) filters.isPublished = isPublished === 'true'; // Convert string to boolean

    const options = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      populateCreator: populateCreator === 'true',
      populateTraining: populateTraining === 'true',
    };

    if (!req.user?.id) { // Assurez-vous que req.user est défini pour passer à getAllQuizzesService
      return next(new ApiError('Authentication required to retrieve quizzes.', 401));
    }

    const quizzes = await getAllQuizzesService(filters, options, req.user);
    res.status(200).json(quizzes);
  } catch (error) {
    next(error);
  }
};

/**
 * Récupère un quiz spécifique par ID.
 * GET /api/quizzes/:id
 * Query params: populateCreator, populateTraining, populateQuestions
 */
export const getQuizById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { populateCreator, populateTraining, populateQuestions } = req.query;

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid quiz ID format.', 400));
    }

    const options = {
      populateCreator: populateCreator === 'true',
      populateTraining: populateTraining === 'true',
      populateQuestions: populateQuestions === 'true',
    };

    if (!req.user?.id) { // Assurez-vous que req.user est défini pour passer à getQuizByIdService
      return next(new ApiError('Authentication required to retrieve a quiz.', 401));
    }

    const quiz = await getQuizByIdService(id, options, req.user);
    res.status(200).json(quiz);
  } catch (error) {
    next(error);
  }
};

/**
 * Supprime un quiz.
 * DELETE /api/quizzes/:id
 */
export const deleteQuiz = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!req.user?.id) {
      return next(new ApiError('Authentication required to delete a quiz.', 401));
    }
    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid quiz ID format.', 400));
    }

    const result = await deleteQuizService(id, req.user);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
