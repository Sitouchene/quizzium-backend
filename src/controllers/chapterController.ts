// src/controllers/chapterController.ts
import { Request, Response, NextFunction } from 'express';
import {
  createChapterService,
  getAllChaptersService,
  getChapterByIdService,
  updateChapterService,
  deleteChapterService,
} from '../services/chapterService';
// Importe l'enum UserRole depuis utils/types.ts
import { ApiError, UserRole } from '../utils/types'; 
import { Types } from 'mongoose';

/**
 * Create a new chapter (Manager/Admin only).
 * POST /api/chapters
 */
export const createChapter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, training, order } = req.body;

    // Vérification d'authentification et d'autorisation
    if (!req.user?.id) {
      return next(new ApiError('Authentication required to create a chapter.', 401));
    }
    // Seuls les managers ou admins peuvent créer des chapitres
    if (![UserRole.MANAGER, UserRole.ADMIN].includes(req.user.role)) {
      return next(new ApiError('Only managers or admins can create chapters.', 403));
    }

    const newChapter = await createChapterService({ title, description, training, order });
    res.status(201).json(newChapter);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all chapters (Accessible by all authenticated roles).
 * GET /api/chapters
 * GET /api/trainings/:trainingId/chapters (nested route)
 * Supports filtering by training ID, pagination, and population of 'questions'.
 */
export const getAllChapters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trainingId } = req.params; // From nested route if applicable
    const { page, limit, populateQuestions } = req.query;

    // Optional: Add authentication check if you want to restrict viewing chapters
    // For now, it's accessible by all authenticated roles as per comment, but you can add:
    // if (!req.user?.id) { return next(new ApiError('Authentication required to view chapters.', 401)); }

    const options = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      populateQuestions: populateQuestions === 'true',
    };

    const chapters = await getAllChaptersService(trainingId, options);
    res.status(200).json(chapters);
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single chapter by ID (Accessible by all authenticated roles).
 * GET /api/chapters/:id
 */
export const getChapterById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { populateQuestions } = req.query;

    // Optional: Add authentication check if you want to restrict viewing chapters
    // if (!req.user?.id) { return next(new ApiError('Authentication required to view a chapter.', 401)); }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid chapter ID format.', 400));
    }

    const options = {
      populateQuestions: populateQuestions === 'true',
    };

    const chapter = await getChapterByIdService(id, options);
    res.status(200).json(chapter);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a chapter (Manager/Admin only).
 * PUT /api/chapters/:id
 */
export const updateChapter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Vérification d'authentification et d'autorisation
    if (!req.user?.id) {
      return next(new ApiError('Authentication required to update a chapter.', 401));
    }
    // Seuls les managers ou admins peuvent mettre à jour des chapitres
    if (![UserRole.MANAGER, UserRole.ADMIN].includes(req.user.role)) {
      return next(new ApiError('Only managers or admins can update chapters.', 403));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid chapter ID format.', 400));
    }
    if (Object.keys(updateData).length === 0) {
      return next(new ApiError('No update data provided.', 400));
    }

    const updatedChapter = await updateChapterService(id, updateData);
    res.status(200).json(updatedChapter);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a chapter (Manager/Admin only).
 * DELETE /api/chapters/:id
 */
export const deleteChapter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Vérification d'authentification et d'autorisation
    if (!req.user?.id) {
      return next(new ApiError('Authentication required to delete a chapter.', 401));
    }
    // Seuls les managers ou admins peuvent supprimer des chapitres
    if (![UserRole.MANAGER, UserRole.ADMIN].includes(req.user.role)) {
      return next(new ApiError('Only managers or admins can delete chapters.', 403));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid chapter ID format.', 400));
    }

    const result = await deleteChapterService(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
