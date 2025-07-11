// src/models/Notification.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { NotificationType, NotificationStatus } from '../utils/types'; // IMPORT MIS À JOUR

// Interface pour le document Notification
export interface INotification extends Document {
  recipient: Types.ObjectId; // Référence à l'utilisateur qui reçoit la notification (Manager/Admin ou Étudiant)
  type: NotificationType; // Type de notification (ex: 'new_enrollment_pending')
  message: string; // Le message de la notification
  relatedEntityId?: Types.ObjectId; // L'ID de l'entité liée (ex: ID de l'inscription)
  relatedEntityType?: string; // Le type de l'entité liée (ex: 'Enrollment')
  status: NotificationStatus; // Statut de lecture (lu/non lu)
  createdAt: Date;
  updatedAt: Date;
}

// Schéma Mongoose pour le modèle Notification
const NotificationSchema: Schema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Référence au modèle User
      required: [true, 'Notification recipient is required'],
    },
    type: {
      type: String,
      enum: Object.values(NotificationType), // Utilise les valeurs de l'enum NotificationType
      required: [true, 'Notification type is required'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: 500,
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    relatedEntityType: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus), // Utilise les valeurs de l'enum NotificationStatus
      default: NotificationStatus.UNREAD,
      required: [true, 'Notification status is required'],
    },
  },
  {
    timestamps: true, // Ajoute createdAt et updatedAt
  }
);

// Index pour optimiser les recherches par destinataire et statut
NotificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ relatedEntityId: 1, relatedEntityType: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
