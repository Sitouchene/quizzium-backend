// src/controllers/trainingController.ts
import { Request, Response, NextFunction } from 'express';
import {
  createTrainingService,
  getAllTrainingsService,
  addChaptersToTrainingService,
  addQuestionsToTrainingService,
  getTrainingByIdService,
  updateTrainingService,
  deleteTrainingService,
  assignTeachersToTrainingService,
} from '../services/trainingService';
import { createMultipleQuestionsService } from '../services/questionService';
// Importe les enums nécessaires depuis utils/types.ts
import { ApiError, UserRole, QuizType } from '../utils/types'; 
import { Types } from 'mongoose'; // For ObjectId validation


/**
 * Create a new training (Manager/Admin only).
 * POST /api/trainings
 */
export const createTraining = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, slug, category, level, isPublished, durationHours, thumbnailUrl, tags } = req.body;

    // Ensure the manager's ID is passed as createdBy from authenticated user
    if (!req.user?.id) {
      return next(new ApiError('User ID not found in request. Authentication required.', 401));
    }
    // Assurez-vous que le rôle de l'utilisateur est bien manager ou admin pour créer
    // Utilisation des valeurs de l'enum UserRole
    if (![UserRole.MANAGER, UserRole.ADMIN].includes(req.user.role)) {
      return next(new ApiError('Only managers or admins can create trainings.', 403));
    }


    const trainingData = {
      title, description, slug, category, level,
      createdBy: req.user.id, // Set createdBy from authenticated user
      isPublished, durationHours, thumbnailUrl, tags
    };

    const newTraining = await createTrainingService(trainingData);
    res.status(201).json(newTraining);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all trainings (Accessible by all authenticated roles).
 * GET /api/trainings
 * Supports filtering, pagination, and population of 'createdBy' and 'teachers'.
 */
export const getAllTrainings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, level, page, limit, populateCreatedBy, populateTeachers } = req.query;

    const filters: any = {};
    if (category) filters.category = category;
    if (level) filters.level = level; // Utilisation directe de la chaîne (si level n'est pas un enum standardisé)

    const options = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      populateCreatedBy: populateCreatedBy === 'true',
      populateTeachers: populateTeachers === 'true',
    };

    const trainings = await getAllTrainingsService(filters, options);
    res.status(200).json(trainings);
  } catch (error) {
    next(error);
  }
};

/**
 * Ajoute un tableau d'IDs de chapitres à une formation.
 * PATCH /api/trainings/:id/add-chapters
 * Corps: { chapterIds: string[] }
 */
export const addChaptersToTraining = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // Training ID
    const { chapterIds } = req.body;

    if (!req.user?.id) {
      return next(new ApiError('Authentication required to add chapters.', 401));
    }
    // Vérification des rôles d'autorisation (Manager/Admin ou Teacher)
    // Utilisation des valeurs de l'enum UserRole
    if (![UserRole.MANAGER, UserRole.ADMIN, UserRole.TEACHER].includes(req.user.role)) {
      return next(new ApiError('Not authorized to add chapters to this training.', 403));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid training ID format.', 400));
    }
    if (!Array.isArray(chapterIds) || chapterIds.length === 0 || !chapterIds.every(cid => Types.ObjectId.isValid(cid))) {
      return next(new ApiError('An array of valid chapter IDs is required.', 400));
    }

    const updatedTraining = await addChaptersToTrainingService(id, chapterIds, req.user);
    res.status(200).json(updatedTraining);
  } catch (error) {
    next(error);
  }
};

/**
 * Crée un tableau de questions et les ajoute à une formation.
 * Ce contrôleur coordonne la création des questions et leur association à la formation.
 * PATCH /api/trainings/:id/add-questions
 * Corps: { questions: QuestionData[] } // questionData est un tableau des objets question complets
 */
export const addQuestionsToTraining = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: trainingId } = req.params; // Training ID
    const questionsData = req.body; // Expecting an array of question objects directly in the body

    if (!req.user?.id) {
      return next(new ApiError('Authentication required to add questions.', 401));
    }
    // Vérification des rôles d'autorisation (Manager/Admin ou Teacher)
    // Utilisation des valeurs de l'enum UserRole
    if (![UserRole.MANAGER, UserRole.ADMIN, UserRole.TEACHER].includes(req.user.role)) {
      return next(new ApiError('Not authorized to add questions to this training.', 403));
    }

    if (!Types.ObjectId.isValid(trainingId)) {
      return next(new ApiError('Invalid training ID format.', 400));
    }
    if (!Array.isArray(questionsData) || questionsData.length === 0) {
      return next(new ApiError('An array of question objects is required in the request body.', 400));
    }

    // 1. Créer les questions et obtenir leurs IDs
    const newQuestionIds = await createMultipleQuestionsService(questionsData);

    // 2. Ajouter les IDs des questions nouvellement créées à la formation
    const updatedTraining = await addQuestionsToTrainingService(trainingId, newQuestionIds, req.user);

    res.status(200).json(updatedTraining);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single training by ID (Accessible by all authenticated roles).
 * GET /api/trainings/:id
 * Supports population of 'createdBy' and 'teachers'.
 */
export const getTrainingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { populateCreatedBy, populateTeachers } = req.query;

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid training ID format.', 400));
    }

    const options = {
      populateCreatedBy: populateCreatedBy === 'true',
      populateTeachers: populateTeachers === 'true',
    };

    const training = await getTrainingByIdService(id, options);
    res.status(200).json(training);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a training (Manager/Admin only).
 * PUT /api/trainings/:id
 */
export const updateTraining = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Utilisation des valeurs de l'enum UserRole
    if (!req.user?.id || ![UserRole.MANAGER, UserRole.ADMIN].includes(req.user.role)) {
      return next(new ApiError('Only managers or admins can update trainings.', 403));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid training ID format.', 400));
    }
    if (Object.keys(updateData).length === 0) {
      return next(new ApiError('No update data provided.', 400));
    }

    const updatedTraining = await updateTrainingService(id, updateData);
    res.status(200).json(updatedTraining);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a training (Manager/Admin only).
 * DELETE /api/trainings/:id
 */
export const deleteTraining = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Utilisation des valeurs de l'enum UserRole
    if (!req.user?.id || ![UserRole.MANAGER, UserRole.ADMIN].includes(req.user.role)) {
      return next(new ApiError('Only managers or admins can delete trainings.', 403));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid training ID format.', 400));
    }

    const result = await deleteTrainingService(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Assigne des enseignants à une formation spécifique.
 * PATCH /api/trainings/:id/assign-teachers
 * Corps: { teachersId: string[] } - Notez le 's' minuscule et 'Id' majuscule pour correspondre à votre requête.
 * Seuls les managers ou admins peuvent assigner des enseignants.
 */
export const assignTeachers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // Training ID
    const { teachersId } = req.body; // <-- Déstructuration du corps de la requête

    // Utilisation des valeurs de l'enum UserRole
    if (!req.user?.id || ![UserRole.MANAGER, UserRole.ADMIN].includes(req.user.role)) {
      return next(new ApiError('Only managers or admins can assign teachers.', 403));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid training ID format.', 400));
    }

    // Validation: s'assurer que 'teachersId' est un tableau et que tous ses éléments sont des ObjectIds valides
    if (!Array.isArray(teachersId) || teachersId.some(tid => !Types.ObjectId.isValid(tid))) {
      return next(new ApiError('Invalid teacher IDs provided. Must be an array of valid ObjectIds.', 400));
    }
    
    const updatedTraining = await assignTeachersToTrainingService(id, teachersId);
    res.status(200).json(updatedTraining);
  } catch (error) {
    next(error);
  }
};