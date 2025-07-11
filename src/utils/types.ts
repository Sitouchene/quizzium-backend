// src/utils/types.ts
import { Types } from 'mongoose'; 

// Classe d'erreur personnalisée pour une meilleure gestion
export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Interfaces pour le contenu localisé
export interface ILocalizedString {
  fr: string;
  en: string;
  ar?: string;
  es?:string;
}

export interface ILocalizedChoice {
  fr: string;
  en?: string;
  ar?: string;
  es?: string;
}

// Enums pour les rôles, statuts et langues (standardisés en enum)
export enum UserRole {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin',
  MANAGER = 'manager',
}

export enum AvailableLanguage {
  FR = 'fr',
  EN = 'en',
  AR = 'ar',
  ES = 'es',
}

export enum QuestionType {
  QCM = 'QCM',
  TRUE_FALSE = 'TrueFalse', // Renommé pour une cohérence de nommage d'enum
  CALCUL = 'Calculation',
}

export enum MediaType {
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum ContentAccessLevel {
  PUBLIC = 'public',          // Visible et jouable par tous.
  AUTHENTICATED = 'authenticated', // Visible par tous, mais nécessite une connexion pour jouer.
  UNLISTED = 'unlisted',        // Non visible dans les listes, accessible par lien direct (B2B).
  RESTRICTED = 'restricted'     // Accessible uniquement aux membres d'une formation.
}

export enum EnrollmentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum QuizType {
  FORMATIVE = 'formative',
  SUMMATIVE = 'summative',
  REVISION = 'revision',
}

export enum NotificationType {
  NEW_ENROLLMENT_PENDING = 'new_enrollment_pending', // Nouvelle inscription à approuver (pour manager/admin)
  ENROLLMENT_STATUS_CHANGED = 'enrollment_status_changed', // Statut d'inscription modifié (pour étudiant)
  QUIZ_GRADED = 'quiz_graded', // Quiz noté (pour teacher)
  // Ajouter d'autres types ici si nécessaire
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
}

// Pour étendre l'interface Request d'Express dans les middlewares
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        slug?: string;
      };
    }
  }
}
