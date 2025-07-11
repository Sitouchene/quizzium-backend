// src/models/Training.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { ILocalizedString, UserRole, AvailableLanguage } from '../utils/types'; 
import { User } from './User';


// Interface pour les documents Training
export interface ITraining extends Document {
  title: ILocalizedString; // Titre multilingue
  description: ILocalizedString; // Description multilingue
  slug: string; // URL conviviale (ex: "mathematiques-niveau-1")
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced'; // Type littéral string, non converti en enum selon votre liste
  chapters: Types.ObjectId[]; // Tableau de références vers les chapitres
  questions?: Types.ObjectId[];
  quizzes?: Types.ObjectId[];
  createdBy: Types.ObjectId; // Référence vers l'utilisateur (professeur/admin) qui a créé la formation
  teachers?: Types.ObjectId[]; // Array of references to User model (teachers)
  isPublished: boolean; // Si la formation est visible ou non
  durationHours?: number; // Durée estimée de la formation en heures
  thumbnailUrl?: string; // URL de l'image de la formation
  tags?: string[]; // Mots-clés pour la recherche
  isGeneral?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Schéma Mongoose pour le modèle Training
const TrainingSchema: Schema = new Schema(
  {
    title: {
      type: Object, // Type Object pour ILocalizedString
      required: [true, 'Training title is required'],
      of: { // Définit la structure de l'objet pour les langues. Les clés sont littérales.
        // Les valeurs de ces clés sont validées comme String. L'enum AvailableLanguage serait
        // utilisé si le champ lui-même était une seule langue préférée, comme dans le modèle User.
        fr: { type: String, required: true, trim: true, maxlength: 100 },
        en: { type: String, required: true, trim: true, maxlength: 100 },
        ar: { type: String, required: false, trim: true, maxlength: 100 },
        es: { type: String, required: false, trim: true, maxlength: 100 },
      },
      // Validation pour s'assurer qu'au moins une langue est fournie
      validate: {
        validator: function (v: ILocalizedString) {
          return v && (!!v.fr || !!v.en || !!v.ar || !!v.es);
        },
        message: 'At least one language version of the title is required',
      },
    },
    description: {
      type: Object,
      required: [true, 'Training description is required'],
      of: {
        fr: { type: String, required: true, trim: true, maxlength: 1000 },
        en: { type: String, required: true, trim: true, maxlength: 1000 },
        ar: { type: String, required: false, trim: true, maxlength: 1000 },
        es: { type: String, required: false, trim: true, maxlength: 1000 },
      },
      validate: {
        validator: function (v: ILocalizedString) {
          return v && (!!v.fr || !!v.en || !!v.ar || !!v.es);
        },
        message: 'At least one language version of the description is required',
      },
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-friendly'], // Regex pour un slug valide
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: 50,
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'], // Ce reste un enum littéral car non standardisé dans utils/types.ts
      default: 'beginner',
      required: [true, 'Level is required'],
    },
    chapters: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Chapter', // Référence au modèle Chapter
      },
    ],
    questions: [ // Ajouté pour référencer directement les questions
      {
        type: Schema.Types.ObjectId,
        ref: 'Question', // Référence au modèle Question
      },
    ],
    quizzes: [ 
      {
        type: Schema.Types.ObjectId,
        ref: 'Quiz', // Référence au modèle Quiz
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Référence au modèle User (le rôle est validé ailleurs)
      required: [true, 'Creator is required'],
    },
    teachers: [ // NEW FIELD FOR TEACHER ASSIGNMENT
      {
        type: Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model (le rôle est validé ailleurs)
        validate: {
          // Validation personnalisée pour s'assurer que l'ID référencé est bien un TEACHER
          validator: async function(v: Types.ObjectId) {
            // Si le document est en cours de création ou si 'teachers' est modifié
            if (!v) return true; // Si c'est null ou undefined, laisser passer (la validation 'required' gérera l'absence)
            const user = await User.findById(v).select('role');
            return user && user.role === UserRole.TEACHER; // Vérifie si l'utilisateur existe et a le rôle TEACHER
          },
          message: 'Only users with the role TEACHER can be assigned as a teacher for this training.',
        },
      },
    ],
    isPublished: {
      type: Boolean,
      default: false,
    },
    durationHours: {
      type: Number,
      min: [0, 'Duration cannot be negative'],
    },
    thumbnailUrl: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxlength: 30,
      },
    ],
     isGeneral: { // Nouveau champ
              type: Boolean,
              default: false,
            },
  },
  {
    timestamps: true,
  }
);

// Index pour optimiser les recherches
TrainingSchema.index({ category: 1, level: 1 });
TrainingSchema.index({ isPublished: 1, publishedAt: -1 });
TrainingSchema.index({ 'title.fr': 1, 'title.en': 1 }); // Index sur les titres localisés
TrainingSchema.index({ tags: 1 });

export const Training = mongoose.model<ITraining>('Training', TrainingSchema);
