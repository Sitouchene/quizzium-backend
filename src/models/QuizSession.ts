// src/models/QuizSession.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
// Importe les enums nécessaires depuis utils/types.ts
import { AvailableLanguage, ILocalizedString, QuestionType, NotificationType } from '../utils/types';
// Note: IChoice as IQuestionChoice n'est pas utilisé directement dans ce fichier,
// il est davantage pertinent pour le modèle Question.

// Simplified IQuestion for client-side to avoid sending sensitive data
export interface IClientQuestion {
  _id: Types.ObjectId;
  text: ILocalizedString;
  type: QuestionType; // Utilise l'enum QuestionType
  choices?: Array<{ text: ILocalizedString }>; // Choices WITHOUT 'isCorrect' for the client
  difficulty: 'easy' | 'medium' | 'hard'; // Reste un type littéral string selon utils/types.ts
  tags?: string[];
  // explanation and correctAnswerFormula should NOT be here
}

// Interface for an individual response within the session document
export interface IQuestionResponse {
  question: Types.ObjectId | IClientQuestion; // Can be ObjectId (before populate) or the full ClientQuestion object (after populate)
  userAnswer: string | string[] | number; // User's answer (can be text, array for multiple QCM, or number for calculation)
  isCorrect: boolean; // Whether the user's answer was correct (INTERNAL, determined on submit)
  scoreEarned: number; // Score earned for this question (e.g., 1 or 0)
  timeTakenSeconds?: number; // Time taken to answer the question
}

// Interface for QuizSession documents
export interface IQuizSession extends Document {
  user?: Types.ObjectId; // Reference to the enrolled user, RENDU OPTIONNEL
  quiz: Types.ObjectId; // Reference to the specific Quiz taken
  quizDate: Date; // Date of the quiz
  totalScoreEarned: number; // Total score obtained by the student for this quiz
  maxPossibleScore: number; // Maximum possible score for the quiz's questions (sum of question points)
  quizGlobalScore: number; // The quiz's overall score (e.g., 20, 100)
  finalCalculatedScore: number; // The student's final score after weighting (e.g., 30*20/40 = 15)
  durationSeconds: number; // Total duration of the quiz session
  responses: IQuestionResponse[]; // Array of user's responses
  guestId?: string;       // NOUVEAU: Pour identifier un joueur non authentifié de manière unique
  guestName?: string;     // NOUVEAU: Le pseudo du joueur non authentifié
  language: AvailableLanguage; // Utilise l'enum AvailableLanguage
  isCompleted: boolean; // Indicates if the session is completed
  passStatus?: 'passed' | 'failed'; // Pass/fail status (if applicable)
  attemptNumber: number; // Attempt number for this quiz
}

// Schema for simplified choice options for the client (no 'isCorrect')
const ClientChoiceSchema: Schema = new Schema(
  {
    text: {
      type: Object,
      required: true,
      of: {
        fr: { type: String, required: true, trim: true, maxlength: 200 },
        en: { type: String, required: true, trim: true, maxlength: 200 },
        ar: { type: String, required: false, trim: true, maxlength: 200 }, // Rendu optionnel pour cohérence
        es: { type: String, required: false, trim: true, maxlength: 200 }, // Rendu optionnel pour cohérence
      },
      validate: {
        validator: function (v: ILocalizedString) {
          return v && (!!v.fr || !!v.en || !!v.ar || !!v.es);
        },
        message: 'At least one language version of the choice text is required',
      },
    },
  },
  { _id: false } // No _id for subdocuments, and specifically no 'isCorrect' for the client-facing schema
);

// Schema for the simplified question version for the client
const ClientQuestionSchema: Schema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    text: {
      type: Object,
      required: true,
      of: {
        fr: { type: String, required: true, trim: true, maxlength: 500 },
        en: { type: String, required: true, trim: true, maxlength: 500 },
        ar: { type: String, required: false, trim: true, maxlength: 500 }, // Rendu optionnel pour cohérence
        es: { type: String, required: false, trim: true, maxlength: 500 }, // Rendu optionnel pour cohérence
      },
      validate: {
        validator: function (v: ILocalizedString) {
          return v && (!!v.fr || !!v.en || !!v.ar || !!v.es);
        },
        message: 'At least one language version of the question text is required',
      },
    },
    type: {
      type: String,
      enum: Object.values(QuestionType), // Utilise Object.values(QuestionType) pour la validation
      required: true,
    },
    choices: [ClientChoiceSchema], // Uses the simplified choice schema WITHOUT 'isCorrect'
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'], // Reste un tableau de littéraux car non défini en enum dans utils/types.ts
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 30,
      },
    ],
  },
  { _id: false } // Important: do not generate an _id for this subdocument as it uses the original question's _id
);


// Schema for individual responses (sub-document) within the QuizSession
const QuestionResponseSchema: Schema = new Schema(
  {
    question: {
      type: Schema.Types.ObjectId, // Keeps it as ObjectId reference in DB
      ref: 'Question',
      required: [true, 'Question ID is required for a response'],
    },
    userAnswer: {
      type: Schema.Types.Mixed, // Can be String, Array of String, or Number
      required: [true, 'User answer is required'],
    },
    isCorrect: {
      type: Boolean,
      required: [true, 'isCorrect flag is required for a response'], // This field is INTERNAL and crucial for scoring logic
    },
    scoreEarned: {
      type: Number,
      required: [true, 'Score earned is required'],
      min: 0,
    },
    timeTakenSeconds: {
      type: Number,
      min: 0,
    },
  },
  { _id: false } // No _id for individual responses
);

// Mongoose Schema for the QuizSession model
const QuizSessionSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false //[true, 'User ID is required for a quiz session'] N'est plus requis
    },
    guestId: { // Pour regrouper les tentatives d'un même invité
    type: String,
    index: true,
    sparse: true, // L'index ne s'applique que si le champ existe
  },
  guestName: {
    type: String,
    trim: true,
  },

    quiz: {
      type: Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Quiz ID is required for a quiz session'],
    },
    quizDate: {
      type: Date,
      default: Date.now,
    },
    totalScoreEarned: {
      type: Number,
      required: [true, 'Total score earned is required'],
      min: 0,
    },
    maxPossibleScore: {
      type: Number,
      required: [true, 'Max possible score is required'],
      min: 1,
    },
    quizGlobalScore: {
      type: Number,
      required: [true, 'Quiz global score is required'],
      min: 1,
    },
    finalCalculatedScore: {
      type: Number,
      required: [true, 'Final calculated score is required'],
      min: 0,
    },
    durationSeconds: {
      type: Number,
      required: [true, 'Duration of quiz session is required'],
      min: 0,
    },
    responses: [QuestionResponseSchema], // Array of QuestionResponseSchema sub-documents
    language: {
      type: String,
      enum: Object.values(AvailableLanguage), // Utilise Object.values(AvailableLanguage)
      required: [true, 'Quiz language is required'],
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    passStatus: {
      type: String,
      enum: ['passed', 'failed'], // Reste un tableau de littéraux car non défini en enum dans utils/types.ts
      default: null,
    },
    attemptNumber: {
      type: Number,
      required: [true, 'Attempt number is required'],
      min: 1,
      default: 1,
    }
  },
  {
    timestamps: true,
  }
);

// Index for optimizing searches
QuizSessionSchema.index({ user: 1, quizDate: -1 });
QuizSessionSchema.index({ quiz: 1, user: 1 }); // To quickly find a user's sessions for a given quiz

export const QuizSession = mongoose.model<IQuizSession>('QuizSession', QuizSessionSchema);
