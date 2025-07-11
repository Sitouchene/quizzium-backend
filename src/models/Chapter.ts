// src/models/Chapter.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { ILocalizedString } from '../utils/types'; // ILocalizedString utilise déjà AvailableLanguage indirectement

// Interface pour les documents Chapter
export interface IChapter extends Document {
  title: ILocalizedString;
  description: ILocalizedString;
  thumbnailUrl?: string; // URL de l'image du chapitre
  training: Types.ObjectId; // Référence à la formation parente
  order: number; // Ordre du chapitre dans la formation
  questions: Types.ObjectId[]; // Tableau de références vers les questions
  createdAt: Date;
  updatedAt: Date;
}

// Schéma Mongoose pour le modèle Chapter
const ChapterSchema: Schema = new Schema(
  {
    title: {
      type: Object,
      required: [true, 'Chapter title is required'],
      of: {
        fr: { type: String, required: true, trim: true, maxlength: 100 },
        en: { type: String, required: true, trim: true, maxlength: 100 },
        ar: { type: String, required: false, trim: true, maxlength: 100 }, // Rend optionnel pour cohérence
        es: { type: String, required: false, trim: true, maxlength: 100 }, // Rend optionnel pour cohérence
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
        fr: { type: String, trim: true, maxlength: 1000 },
        en: { type: String, trim: true, maxlength: 1000 },
        ar: { type: String, trim: true, maxlength: 1000 },
        es: { type: String, trim: true, maxlength: 1000 },
      },
      validate: {
        validator: function (v: ILocalizedString) {
          return v && (!!v.fr || !!v.en || !!v.ar || !!v.es);
        },
        message: 'At least one language version of the description is required',
      },
    },
    thumbnailUrl: {
      type: String,
      trim: true,
    },
    training: {
      type: Schema.Types.ObjectId,
      ref: 'Training', // Référence au modèle Training
      required: [true, 'Chapter must belong to a training'],
    },
    order: {
      type: Number,
      required: [true, 'Chapter order is required'],
      min: [1, 'Order must be a positive number'],
    },
    questions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question', // Référence au modèle Question
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index unique composé pour garantir l'ordre des chapitres par formation
ChapterSchema.index({ training: 1, order: 1 }, { unique: true });
ChapterSchema.index({ training: 1, 'title.fr': 1 }); // Index pour recherche de chapitre par titre dans une formation

export const Chapter = mongoose.model<IChapter>('Chapter', ChapterSchema);
