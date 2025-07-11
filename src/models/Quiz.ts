// src/models/Quiz.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { ILocalizedString, QuizType } from '../utils/types';


// Sous-document pour la liste des questions avec leurs points
export interface IQuestionWithScore {
  questionId: Types.ObjectId; // Référence à la question
  score: number; // Points attribués à cette question pour ce quiz
}

// Interface pour les documents Quiz
export interface IQuiz extends Document {
  training: Types.ObjectId; // Référence à la formation associée
  title: ILocalizedString; // Titre du quiz (multilingue)
  description?: ILocalizedString; // Description du quiz (multilingue, optionnel)
  thumbnailUrl?: string; // URL de l'image du quizz
  creator: Types.ObjectId; // Référence à l'utilisateur qui a créé le quiz (enseignant ou élève)
  quizType: QuizType; // 'formative', 'summative', 'revision'
  deadline?: Date; // Date limite pour passer le quiz (pour les quizzes enseignants)
  isPublished: boolean; // Indique si le quiz est visible/disponible aux élèves
  publishedAt?: Date; // Date de publication du quiz
  durationMinutes?: number; // Durée en minutes, ou indéfini si illimité
  questions: IQuestionWithScore[]; // Liste des questions avec leurs points
  globalScore: number; // Note globale du quiz (sur laquelle le score de l'élève sera pondéré)
  allowedAttempts?: number; // Nombre de tentatives autorisées, ou indéfini si illimité
  tags?: string[]; // Mots-clés pour la recherche/organisation
  isPublic: boolean; // Nouveau champ : true si le quiz est accessible sans authentification
  slug: string; // Nouveau champ : slug pour l'URL lisible par l'homme
  createdAt: Date;
  updatedAt: Date;
}

// Schéma pour les questions avec score (sous-document)
const QuestionWithScoreSchema: Schema = new Schema(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: [true, 'Question ID is required'],
    },
    score: {
      type: Number,
      required: [true, 'Score for the question is required'],
      min: [0, 'Score cannot be negative'],
    },
  },
  { _id: false } // Pas besoin d'ID pour chaque question individuelle dans la liste
);

// Schéma Mongoose pour le modèle Quiz
const QuizSchema: Schema = new Schema(
  {
    training: {
      type: Schema.Types.ObjectId,
      ref: 'Training',
      required: [true, 'Training ID is required for a quiz'],
    },
    title: {
      type: Object,
      required: [true, 'Quiz title is required'],
      of: {
        fr: { type: String, required: true, trim: true, maxlength: 100 },
        en: { type: String, required: true, trim: true, maxlength: 100 },
        ar: { type: String, required: false, trim: true, maxlength: 100 },
        es: { type: String, required: false, trim: true, maxlength: 100 },
      },
      validate: {
        validator: function (v: ILocalizedString) {
          return v && (!!v.fr || !!v.en || !!v.ar || !!v.es);
        },
        message: 'At least one language version of the title is required',
      },
    },
    description: {
      type: Object,
      of: {
        fr: { type: String, trim: true, maxlength: 500 },
        en: { type: String, trim: true, maxlength: 500 },
        ar: { type: String, trim: true, maxlength: 500 },
        es: { type: String, trim: true, maxlength: 500 },
      },
      validate: {
        validator: function (v: ILocalizedString) {
          if (v) return (!!v.fr || !!v.en || !!v.ar || !!v.es);
          return true;
        },
        message: 'At least one language version of the description is required if description is provided.',
      },
    },
    thumbnailUrl: {
      type: String,
      trim: true,
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator ID is required for a quiz'],
    },
      slug: {
      type: String,
      required: [true, 'Slug is required'],
      trim: true,
      lowercase: true,
      minlength: [3, 'Slug must be at least 3 characters long'],
      maxlength: [100, 'Slug cannot be more than 100 characters long'],
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen.'], // Regex for slug format
    },
    quizType: {
      type: String,
      enum: Object.values(QuizType),
      default: QuizType.FORMATIVE,
      required: [true, 'Quiz type is required'],
    },
    deadline: {
      type: Date,
      default: null,
      required: function (this: IQuiz) {
        // La validation réelle du rôle doit être faite dans le service ou le contrôleur.
        // Ici, on valide seulement en fonction du `quizType`.
        return this.quizType !== QuizType.REVISION;
      },
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
      default: null,
      required: function (this: IQuiz) {
        return this.isPublished === true;
      },
    },
    durationMinutes: {
      type: Number,
      min: [0, 'Duration cannot be negative'],
      default: null, // Si illimité
    },
    questions: {
      type: [QuestionWithScoreSchema], // Tableau de sous-documents QuestionWithScoreSchema
      required: [true, 'Questions are required for a quiz'],
      validate: {
        validator: function (val: IQuestionWithScore[]) {
          return val.length > 0;
        },
        message: 'A quiz must contain at least one question.',
      },
    },
    globalScore: {
      type: Number,
      required: [true, 'Global score for the quiz is required'],
      min: [1, 'Global score must be at least 1'],
    },
    allowedAttempts: {
      type: Number,
      min: [0, 'Allowed attempts cannot be negative'],
      default: null, // Si illimité
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 30,
      },
    ],
    isPublic: { // Nouveau champ
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Ajoute createdAt et updatedAt
  }
);

// Index pour optimiser les recherches
QuizSchema.index({ training: 1, quizType: 1 });
QuizSchema.index({ creator: 1 });
QuizSchema.index({ isPublished: 1, publishedAt: -1 });
QuizSchema.index({ tags: 1 });
QuizSchema.index({ isPublic: 1 }); // Index pour rechercher rapidement les quiz publics
QuizSchema.index({ slug: 1 }, { unique: true }); // Index pour garantir l'unicité du slug


export const Quiz = mongoose.model<IQuiz>('Quiz', QuizSchema);
