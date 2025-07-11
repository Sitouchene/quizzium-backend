// src/controllers/notificationController.ts
import { Request, Response, NextFunction } from 'express';
import {
  getNotificationsForUserService,
  markNotificationAsReadService,
  deleteNotificationService,
} from '../services/notificationService';
import { ApiError, UserRole, NotificationStatus } from '../utils/types';
import { Types } from 'mongoose';


/**
 * Récupère les notifications pour l'utilisateur authentifié.
 * GET /api/notifications
 * Query params: status (ex: 'unread')
 */
export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id; // L'ID de l'utilisateur est extrait du token JWT par `protect`

    if (!userId) {
      return next(new ApiError('Authentication required to retrieve notifications.', 401));
    }

    const { status, page, limit } = req.query;

    const filters: { status?: NotificationStatus } = {};
    if (status && (status === NotificationStatus.READ || status === NotificationStatus.UNREAD)) {
      filters.status = status as NotificationStatus;
    } else if (status) {
      return next(new ApiError('Invalid status filter. Must be "read" or "unread".', 400));
    }

    const options = {
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    };

    const notifications = await getNotificationsForUserService(userId, filters, options);
    res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
};

/**
 * Marque une notification spécifique comme lue.
 * PATCH /api/notifications/:id/read
 */
export const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // Notification ID
    const userId = req.user?.id;

    if (!userId) {
      return next(new ApiError('Authentication required to mark notification as read.', 401));
    }
    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid notification ID format.', 400));
    }

    const updatedNotification = await markNotificationAsReadService(id, userId);
    res.status(200).json(updatedNotification);
  } catch (error) {
    next(error);
  }
};

/**
 * Supprime une notification spécifique.
 * DELETE /api/notifications/:id
 * Autorisation gérée dans le service (destinataire ou admin/manager).
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // Notification ID
    const requestingUser = req.user;

    if (!requestingUser?.id) {
      return next(new ApiError('Authentication required to delete notification.', 401));
    }
    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid notification ID format.', 400));
    }

    const result = await deleteNotificationService(id, requestingUser);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
