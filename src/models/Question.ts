// src/models/Question.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
// Importe les enums et interfaces nécessaires depuis utils/types.ts
// NOUVEAU: Importer MediaType d'ici
import { ILocalizedString, ILocalizedChoice, QuestionType, AvailableLanguage, MediaType } from '../utils/types'; 

// REMOVE THIS BLOCK if it's currently here:
// export enum MediaType {
//   IMAGE = 'image',
//   AUDIO = 'audio',
//   VIDEO = 'video',
// }

// Interface pour les options de réponse (utilisé par QCM)
export interface IChoice {
  text: ILocalizedChoice; // Texte de l'option (multilingue)
  isCorrect: boolean; // Si c'est la bonne réponse
  choiceMediaType?: MediaType; // Nouveau: Type de média pour l'option
  choiceMediaUrl?: string; // Nouveau: URL du média pour l'option
  choiceMediaAltText?: string; // NOUVEAU: Texte alternatif simple (une seule langue)
}

// Interface pour les documents Question
export interface IQuestion extends Document {
  chapter: Types.ObjectId; // Référence au chapitre parent
  text: ILocalizedString; // Texte de la question (multilingue)
  mediaType?: MediaType; // Nouveau: Type de média pour la question
  mediaUrl?: string; // Nouveau: URL du média pour la question
  mediaAltText?: string; // NOUVEAU: Texte alternatif simple (une seule langue)
  type: QuestionType; // Utilise l'enum QuestionType
  choices?: IChoice[]; // Options pour les questions de type QCM
  correctAnswerFormula?: string; // Formule ou valeur attendue pour les questions de type 'Calcul'
  explanation?: ILocalizedString; // Explication de la réponse (multilingue, optionnel)
  difficulty: 'easy' | 'medium' | 'hard'; // Reste un type littéral string selon utils/types.ts
  tags?: string[]; // Mots-clés pour la recherche/organisation
  createdAt: Date;
  updatedAt: Date;
}

// Schéma pour les options de réponse (sous-document de Question)
const ChoiceSchema: Schema = new Schema(
  {
    text: {
      type: Object,
      required: [true, 'Choice text is required'],
      of: {
        fr: { type: String, required: true, trim: true, maxlength: 200 },
        en: { type: String, required: true, trim: true, maxlength: 200 },
        ar: { type: String, required: false, trim: true, maxlength: 200 }, 
        es: { type: String, required: false, trim: true, maxlength: 200 }, 
      },
      validate: { 
        validator: function (v: ILocalizedChoice) {
          return v && (!!v.fr || !!v.en || !!v.ar || !!v.es);
        },
        message: 'At least one language version of the choice text is required',
      },
    },
    isCorrect: {
      type: Boolean,
      required: [true, 'isCorrect flag is required for a choice'],
    },
    choiceMediaType: { 
      type: String,
      enum: Object.values(MediaType), // Maintenant MediaType vient de utils/types.ts
      required: function (this: IChoice) { return !!this.choiceMediaUrl; }, 
    },
    choiceMediaUrl: { 
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Please use a valid URL for choice media'], 
      required: function (this: IChoice) { return !!this.choiceMediaType; }, 
    },
    choiceMediaAltText: { 
      type: String,
      trim: true,
      maxlength: 200,
      required: function (this: IChoice) { return this.choiceMediaType === MediaType.IMAGE; }, 
    },
  },
  { _id: false } 
);

// Schéma Mongoose pour le modèle Question
const QuestionSchema: Schema = new Schema(
  {
    chapter: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      required: [true, 'Question must belong to a chapter'],
    },
    text: {
      type: Object,
      required: [true, 'Question text is required'],
      of: {
        fr: { type: String, required: true, trim: true, maxlength: 500 },
        en: { type: String, required: true, trim: true, maxlength: 500 },
        ar: { type: String, required: false, trim: true, maxlength: 500 }, 
        es: { type: String, required: false, trim: true, maxlength: 500 }, 
      },
      validate: {
        validator: function (v: ILocalizedString) {
          return v && (!!v.fr || !!v.en || !!v.ar || !!v.es);
        },
        message: 'At least one language version of the question text is required',
      },
    },
    mediaType: { 
      type: String,
      enum: Object.values(MediaType), // Maintenant MediaType vient de utils/types.ts
      required: function (this: IQuestion) { return !!this.mediaUrl; }, 
    },
    mediaUrl: { 
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, 'Please use a valid URL for media'], 
      required: function (this: IQuestion) { return !!this.mediaType; }, 
    },
    mediaAltText: { 
      type: String,
      trim: true,
      maxlength: 200,
      required: function (this: IQuestion) { return this.mediaType === MediaType.IMAGE; }, 
    },
    type: {
      type: String,
      enum: Object.values(QuestionType), 
      required: [true, 'Question type is required'],
    },
    choices: {
      type: [ChoiceSchema], 
      required: function (this: IQuestion) {
        return this.type === QuestionType.QCM; 
      }, 
      validate: {
        validator: function (this: IQuestion, val: IChoice[]) {
          if (this.type === QuestionType.QCM && val && val.length > 0) { 
            return val.some((choice) => choice.isCorrect);
          }
          return true;
        },
        message: 'QCM questions must have at least one correct choice.',
      },
    },
    correctAnswerFormula: {
      type: String,
      required: function (this: IQuestion) {
        return this.type === QuestionType.CALCUL; 
      }, 
      trim: true,
      maxlength: 200,
    },
    explanation: {
      type: Object,
      of: {
        fr: { type: String, trim: true, maxlength: 1000 },
        en: { type: String, trim: true, maxlength: 1000 },
        ar: { type: String, trim: true, maxlength: 1000 },
        es: { type: String, trim: true, maxlength: 1000 },
      },
      validate: {
        validator: function (v: ILocalizedString) {
          if (v) return (!!v.fr || !!v.en || !!v.ar || !!v.es);
          return true; 
        },
        message: 'At least one language version of the explanation is required if explanation is provided.',
      },
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'], 
      default: 'medium',
      required: [true, 'Difficulty is required'],
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 30,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index pour optimiser les recherches
QuestionSchema.index({ chapter: 1 });
QuestionSchema.index({ type: 1, difficulty: 1 });
QuestionSchema.index({ tags: 1 });
QuestionSchema.index({ mediaType: 1 }); // Nouveau: pour filtrer par type de média

export const Question = mongoose.model<IQuestion>('Question', QuestionSchema);
