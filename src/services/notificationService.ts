// src/services/notificationService.ts
import { Notification, INotification } from '../models/Notification';
import { User } from '../models/User';
import { ApiError, UserRole, NotificationType, NotificationStatus } from '../utils/types';
import { Types } from 'mongoose';

// Interfaces pour les données d'entrée des services de notification
interface CreateNotificationData {
  recipientId: string;
  type: NotificationType;
  message: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
}

/**
 * Crée une nouvelle notification.
 * @param data Données de la notification.
 * @returns Le document Notification créé.
 * @throws ApiError si le destinataire n'est pas trouvé ou en cas d'erreur de validation.
 */
export const createNotificationService = async (data: CreateNotificationData): Promise<INotification> => {
  const { recipientId, type, message, relatedEntityId, relatedEntityType } = data;

  if (!Types.ObjectId.isValid(recipientId)) {
    throw new ApiError('Invalid recipient ID format for notification.', 400);
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) {
    throw new ApiError('Notification recipient user not found.', 404);
  }

  const newNotification = new Notification({
    recipient: new Types.ObjectId(recipientId),
    type,
    message,
    relatedEntityId: relatedEntityId ? new Types.ObjectId(relatedEntityId) : undefined,
    relatedEntityType: relatedEntityType,
    status: NotificationStatus.UNREAD,
  });

  try {
    await newNotification.save();
    return newNotification;
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to create notification: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Récupère les notifications pour un utilisateur donné, avec filtres et pagination.
 * Un utilisateur ne peut voir que ses propres notifications.
 * @param userId L'ID de l'utilisateur demandant les notifications.
 * @param filters Filtres optionnels (ex: status='unread').
 * @param options Options de pagination.
 * @returns Un tableau de documents Notification.
 */
export const getNotificationsForUserService = async (
  userId: string,
  filters: { status?: NotificationStatus } = {},
  options: { page?: number; limit?: number } = {}
): Promise<INotification[]> => {
  if (!Types.ObjectId.isValid(userId)) {
    throw new ApiError('Invalid user ID format.', 400);
  }

  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const queryFilters: any = { recipient: new Types.ObjectId(userId) };
  if (filters.status) {
    queryFilters.status = filters.status;
  }

  const notifications = await Notification.find(queryFilters)
    .sort({ createdAt: -1 }) // Les plus récentes en premier
    .skip(skip)
    .limit(limit)
    .lean();

  return notifications;
};

/**
 * Marque une notification comme lue.
 * @param notificationId L'ID de la notification à marquer comme lue.
 * @param userId L'ID de l'utilisateur demandant l'action (doit être le destinataire).
 * @returns Le document Notification mis à jour.
 * @throws ApiError si la notification n'est pas trouvée ou non autorisée.
 */
export const markNotificationAsReadService = async (
  notificationId: string,
  userId: string
): Promise<INotification> => {
  if (!Types.ObjectId.isValid(notificationId)) {
    throw new ApiError('Invalid notification ID format.', 400);
  }
  if (!Types.ObjectId.isValid(userId)) {
    throw new ApiError('Invalid user ID format.', 400);
  }

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new ApiError('Notification not found.', 404);
  }

  if (notification.recipient.toString() !== userId) {
    throw new ApiError('Not authorized to mark this notification as read.', 403);
  }

  if (notification.status === NotificationStatus.READ) {
    return notification; // Déjà lue, pas de changement
  }

  notification.status = NotificationStatus.READ;

  try {
    await notification.save();
    return notification;
  } catch (error: any) {
    throw new ApiError(`Failed to mark notification as read: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Supprime une notification.
 * Normalement accessible par les administrateurs/managers, ou par l'utilisateur destinataire.
 * @param notificationId L'ID de la notification à supprimer.
 * @param requestingUser L'utilisateur qui fait la requête.
 * @returns Message de succès.
 * @throws ApiError si la notification n'est pas trouvée ou non autorisée.
 */
export const deleteNotificationService = async (
  notificationId: string,
  requestingUser: { id: string; role: UserRole }
): Promise<{ message: string }> => {
  if (!Types.ObjectId.isValid(notificationId)) {
    throw new ApiError('Invalid notification ID format.', 400);
  }

  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new ApiError('Notification not found or already deleted.', 404);
  }

  const isRecipient = notification.recipient.toString() === requestingUser.id;
  const isAdminOrManager = [UserRole.ADMIN, UserRole.MANAGER].includes(requestingUser.role); // Utilisation de UserRole enum

  if (!isRecipient && !isAdminOrManager) {
    throw new ApiError('Not authorized to delete this notification.', 403);
  }

  try {
    await Notification.deleteOne({ _id: notificationId });
    return { message: 'Notification deleted successfully.' };
  } catch (error: any) {
    throw new ApiError(`Failed to delete notification: ${error.message || 'Unknown error'}`, 500);
  }
};
