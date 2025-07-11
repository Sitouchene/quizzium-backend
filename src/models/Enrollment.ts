// src/models/Enrollment.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
// Importe l'enum EnrollmentStatus depuis utils/types.ts
import { EnrollmentStatus } from '../utils/types';

// Interface pour les documents Enrollment
export interface IEnrollment extends Document {
  user: Types.ObjectId; // Référence vers l'utilisateur inscrit
  training: Types.ObjectId; // Référence vers la formation à laquelle l'utilisateur est inscrit
  enrollmentDate: Date;
  status: EnrollmentStatus; // Utilise l'enum EnrollmentStatus
  progressPercentage: number; // Pourcentage d'avancement dans la formation
  completedChapters: Types.ObjectId[]; // Chapitres déjà complétés
  completionDate?: Date; // Date de complétion de la formation (si applicable)
  score?: number; // Score final obtenu (si un examen final existe)
  certificateUrl?: string; // URL du certificat (si délivré)
}

// Schéma Mongoose pour le modèle Enrollment
const EnrollmentSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for enrollment'],
    },
    training: {
      type: Schema.Types.ObjectId,
      ref: 'Training',
      required: [true, 'Training ID is required for enrollment'],
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: Object.values(EnrollmentStatus), // Utilise Object.values(EnrollmentStatus) pour la validation
      default: EnrollmentStatus.PENDING, // Utilise la valeur de l'enum
      required: [true, 'Enrollment status is required'],
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: [0, 'Progress cannot be negative'],
      max: [100, 'Progress cannot exceed 100'],
    },
    completedChapters: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Chapter',
      },
    ],
    completionDate: {
      type: Date,
      default: null,
    },
    score: {
      type: Number,
      min: [0, 'Score cannot be negative'],
      max: [100, 'Score cannot exceed 100'],
    },
    certificateUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // Ajoute createdAt et updatedAt
  }
);

// Index unique composé pour s'assurer qu'un utilisateur ne peut s'inscrire qu'une seule fois à une formation
EnrollmentSchema.index({ user: 1, training: 1 }, { unique: true });
EnrollmentSchema.index({ status: 1 }); // Pour filtrer les inscriptions par statut

export const Enrollment = mongoose.model<IEnrollment>('Enrollment', EnrollmentSchema);
