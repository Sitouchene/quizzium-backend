import mongoose, { Schema, Document, Types } from 'mongoose';
import { UserRole, AvailableLanguage } from '../utils/types';

// Helper function to convert string to kebab-case
const toKebabCase = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove all non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove hyphens at start and end
};

// Interface for the Profile sub-document
export interface IProfile {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
  avatarUrl?: string;
  bio?: string;
  preferredLanguage?: AvailableLanguage;
  spokenLanguages?: AvailableLanguage[];
}

// Interface for User documents
export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  profile?: IProfile;
  lastLogin?: Date;
  isActive: boolean;
  slug: string; // <--- ADDED: Slug for unique URL identification
}

// Mongoose Schema for the Profile sub-document
const ProfileSchema: Schema = new Schema({
  firstName: { type: String, trim: true, maxlength: 50 },
  lastName: { type: String, trim: true, maxlength: 50 },
  dateOfBirth: { type: Date },
  avatarUrl: { type: String, trim: true },
  bio: { type: String, trim: true, maxlength: 500 },
  preferredLanguage: {
    type: String,
    enum: Object.values(AvailableLanguage),
    default: AvailableLanguage.FR,
  },
  spokenLanguages: {
    type: [String],
    enum: Object.values(AvailableLanguage),
    default: [],
  },
}, { _id: false });

// Mongoose Schema for the User model
const UserSchema: Schema = new Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.STUDENT,
      required: [true, 'User role is required'],
    },
    profile: ProfileSchema,
    lastLogin: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    slug: { // <--- ADDED: Slug field definition
      type: String,
      unique: true,
      required: false, // Set to false initially to allow adding to existing users, then can be true after migration
      trim: true,
      sparse: true, // Allows documents to not have this field without violating unique index
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate or update the slug
UserSchema.pre<IUser>('save', function (next) {
  // Only generate/update slug if it's a new document or username is modified
  if (this.isNew || this.isModified('username')) {
    // Generate base slug from username
    const baseSlug = toKebabCase(this.username);

    // If it's a new document, we need to wait for _id to be assigned.
    // However, pre-save hook runs *before* _id is assigned by MongoDB
    // for new documents. A common pattern is to either:
    // 1. Generate a temporary slug and then update it after save, or
    // 2. Use a unique suffix (like random string) for pre-save and
    //    ensure uniqueness, then rely on it.
    // A simpler approach for combined username + _id part is to generate it
    // during a save, if _id is already present. For first save, if _id
    // isn't present, we can just use the username base.

    // For simplicity, let's generate a slug without the _id suffix here
    // and rely on MongoDB's unique index to prevent duplicates.
    // If you need the _id suffix for initial slug generation, that requires
    // saving once to get the _id, then updating, or using a post-save hook
    // which then triggers another save (less efficient).

    // Let's go with a robust approach: pre-save generates a base, and we ensure uniqueness.
    // If you explicitly want ID in first slug, you might need a separate service
    // or two-step save.
    // For `this._id` in `pre('save')` for *new* documents, it's often generated client-side by Mongoose,
    // but not yet persisted. So it can be used.

    let uniqueSuffix = '';
    if (this._id) {
      // Use the last 4 characters of the _id for uniqueness
      uniqueSuffix = this._id.toString().slice(-4);
    } else {
      // Fallback for cases where _id might not be immediately available
      // (though Mongoose typically assigns it before pre-save for new docs)
      uniqueSuffix = Math.random().toString(36).substring(2, 6); // Random 4 chars
    }

    // Combine base slug with a unique suffix derived from _id or random string
    this.slug = `${baseSlug}-${uniqueSuffix}`;
  }
  next();
});

export const User = mongoose.model<IUser>('User', UserSchema);