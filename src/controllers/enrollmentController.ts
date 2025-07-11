// src/controllers/enrollmentController.ts
import { Request, Response, NextFunction } from 'express';
import {
  createEnrollmentService,
  getAllEnrollmentsService,
  getEnrollmentByIdService,
  updateEnrollmentService,
  deleteEnrollmentService,
  updateStudentProgressService,
} from '../services/enrollmentService';
// Importe les enums nécessaires depuis utils/types.ts
import { ApiError, EnrollmentStatus, UserRole } from '../utils/types';
import { Types } from 'mongoose';


/**
 * Crée une nouvelle inscription (normalement initiée par un admin/manager, ou par l'utilisateur lui-même).
 * POST /api/enrollments
 * Body: { user (optional, if student self-enrolling), trainingId }
 */
export const createEnrollment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user: userIdFromRequestBody, training: trainingId } = req.body;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    if (!requestingUserId || !requestingUserRole) {
      return next(new ApiError('Authentication required to create an enrollment.', 401));
    }
    if (!trainingId || !Types.ObjectId.isValid(trainingId)) {
      return next(new ApiError('Valid training ID is required.', 400));
    }

    let targetUserId = userIdFromRequestBody;
    // Si l'utilisateur est un étudiant, il ne peut s'inscrire que lui-même
    if (requestingUserRole === UserRole.STUDENT) { // Utilisation de la valeur de l'enum UserRole
      targetUserId = requestingUserId;
    } else if (!targetUserId || !Types.ObjectId.isValid(targetUserId)) {
      // Pour manager/admin, un userId doit être fourni dans le corps s'il n'est pas l'utilisateur courant
      return next(new ApiError('Valid user ID is required in the request body for this role.', 400));
    }

    const newEnrollment = await createEnrollmentService(
      { user: targetUserId, training: trainingId },
      requestingUserRole,
      requestingUserId
    );
    res.status(201).json(newEnrollment);
  } catch (error) {
    next(error);
  }
};

/**
 * Récupère toutes les inscriptions.
 * GET /api/enrollments
 * Les filtres et le contrôle d'accès sont gérés au niveau du service.
 */
export const getAllEnrollments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestingUser = req.user;
    if (!requestingUser) {
      return next(new ApiError('Authentication required to get enrollments.', 401));
    }

    const { user, training, status, page, limit, populateUser, populateTraining } = req.query;

    const filters: any = {};
    if (user) filters.user = user;
    if (training) filters.training = training;
    // Valide que le statut fourni est une valeur valide de l'enum EnrollmentStatus
    if (status && Object.values(EnrollmentStatus).includes(status as EnrollmentStatus)) { // Utilisation de Object.values(EnrollmentStatus)
      filters.status = status as EnrollmentStatus;
    } else if (status) {
      return next(new ApiError(`Invalid status filter. Must be one of: ${Object.values(EnrollmentStatus).join(', ')}.`, 400));
    }

    const options = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      populateUser: populateUser === 'true',
      populateTraining: populateTraining === 'true',
    };

    const enrollments = await getAllEnrollmentsService(filters, options, requestingUser);
    res.status(200).json(enrollments);
  } catch (error) {
    next(error);
  }
};

/**
 * Récupère une seule inscription par ID.
 * GET /api/enrollments/:id
 * Le contrôle d'accès est géré au niveau du service.
 */
export const getEnrollmentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;
    if (!requestingUser) {
      return next(new ApiError('Authentication required to get enrollment by ID.', 401));
    }

    const { populateUser, populateTraining } = req.query;

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid enrollment ID format.', 400));
    }

    const options = {
      populateUser: populateUser === 'true',
      populateTraining: populateTraining === 'true',
    };

    const enrollment = await getEnrollmentByIdService(id, options, requestingUser);
    res.status(200).json(enrollment);
  } catch (error) {
    next(error);
  }
};

/**
 * Met à jour une inscription.
 * PUT /api/enrollments/:id
 * Le contrôle d'accès est géré au niveau du service.
 */
export const updateEnrollment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const requestingUser = req.user;

    if (!requestingUser) {
      return next(new ApiError('Authentication required to update an enrollment.', 401));
    }
    // Ajout d'une vérification de rôle pour les mises à jour
    // Seuls les managers et admins, ou l'étudiant lui-même (pour ses champs autorisés), peuvent mettre à jour.
    // La logique de granularité des champs est dans le service.
    if (![UserRole.MANAGER, UserRole.ADMIN, UserRole.STUDENT].includes(requestingUser.role)) {
      return next(new ApiError('Not authorized to update enrollments with this role.', 403));
    }


    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid enrollment ID format.', 400));
    }

    const updatedEnrollment = await updateEnrollmentService(id, updateData, requestingUser);
    res.status(200).json(updatedEnrollment);
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint spécifique pour les étudiants pour marquer un chapitre comme terminé
 * et mettre à jour leur progression.
 * PATCH /api/enrollments/:id/complete-chapter
 * Body: { chapterId: string, newProgressPercentage: number }
 */
export const completeChapter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // Enrollment ID
    const { chapterId, newProgressPercentage } = req.body;
    const requestingUserId = req.user?.id;
    const requestingUserRole = req.user?.role;

    if (!requestingUserId || !requestingUserRole) {
      return next(new ApiError('Authentication required.', 401));
    }
    // Seuls les étudiants peuvent utiliser cet endpoint
    if (requestingUserRole !== UserRole.STUDENT) {
      return next(new ApiError('Only students can mark chapters as complete.', 403));
    }

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid enrollment ID format.', 400));
    }
    if (!chapterId || !Types.ObjectId.isValid(chapterId)) {
      return next(new ApiError('Valid chapter ID is required.', 400));
    }
    // Validation du pourcentage est gérée dans le service

    const updatedEnrollment = await updateStudentProgressService(id, chapterId, newProgressPercentage, requestingUserId);
    res.status(200).json(updatedEnrollment);
  } catch (error) {
    next(error);
  }
};

/**
 * Supprime une inscription.
 * DELETE /api/enrollments/:id
 * Le contrôle d'accès est géré au niveau du service.
 */
export const deleteEnrollment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const requestingUser = req.user;

    if (!requestingUser) {
      return next(new ApiError('Authentication required to delete an enrollment.', 401));
    }
    // Seuls les managers ou admins peuvent supprimer des inscriptions
    if (![UserRole.MANAGER, UserRole.ADMIN].includes(requestingUser.role)) { // Utilisation des valeurs de l'enum UserRole
      return next(new ApiError('Not authorized to delete enrollments.', 403));
    }
    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid enrollment ID format.', 400));
    }

    const result = await deleteEnrollmentService(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
