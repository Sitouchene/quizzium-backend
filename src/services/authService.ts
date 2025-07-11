import { User, IUser } from '../models/User'; // Import IUser for correct typing
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { UserRole, ApiError } from '../utils/types';
import { Types } from 'mongoose';

interface RegisterUserData {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
  firstName?: string;
  lastName?: string;
  preferredLanguage?: 'fr' | 'en';
}

interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    slug: string; // <--- ADDED: slug to AuthResponse interface
    profile: {
      firstName?: string;
      lastName?: string;
      preferredLanguage?: 'fr' | 'en';
      // Add other profile fields if you want them in the AuthResponse, e.g., avatarUrl?: string;
    };
  };
}

export const registerUserService = async (data: RegisterUserData): Promise<AuthResponse> => {
  const { username, email, password, role, firstName, lastName, preferredLanguage } = data; // Added preferredLanguage to destructuring

  const existingUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    throw new ApiError('User with this username or email already exists.', 400);
  }

  const passwordHash = await hashPassword(password);

  const newUser = new User({
    username,
    email,
    passwordHash,
    role: role || 'student',
    profile: {
      firstName: firstName || '',
      lastName: lastName || '',
      preferredLanguage: preferredLanguage || 'fr',
    },
    isActive: true,
    lastLogin: null,
  });

  await newUser.save(); // The pre('save') hook in User model generates the slug here

  const userId = (newUser._id as Types.ObjectId).toString();
  const token = generateToken(userId, newUser.role);

  return {
    token,
    user: {
      id: userId,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      slug: newUser.slug, // <--- INCLUDED: newUser.slug in the response
      profile: {
        firstName: newUser.profile?.firstName,
        lastName: newUser.profile?.lastName,
        preferredLanguage: newUser.profile?.preferredLanguage,
      },
    },
  };
};

export const loginUserService = async (email: string, password: string): Promise<AuthResponse> => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError('Invalid credentials.', 400);
  }

  if (!user.isActive) {
    throw new ApiError('Your account is inactive. Please contact support.', 403);
  }

  const isMatch = await comparePassword(password, user.passwordHash);
  if (!isMatch) {
    throw new ApiError('Invalid credentials.', 400);
  }

  user.lastLogin = new Date();
  await user.save(); // This save also ensures the slug is generated/updated if conditions in pre-save met

  const userId = (user._id as Types.ObjectId).toString();
  const token = generateToken(userId, user.role);

  return {
    token,
    user: {
      id: userId,
      username: user.username,
      email: user.email,
      role: user.role,
      slug: user.slug, // <--- INCLUDED: user.slug in the response
      profile: {
        firstName: user.profile?.firstName,
        lastName: user.profile?.lastName,
        preferredLanguage: user.profile?.preferredLanguage,
      },
    },
  };
};

export const getMyProfileService = async (userId: string): Promise<Omit<IUser, 'passwordHash'>> => {
  const user = await User.findById(userId).select('-passwordHash').lean();

  if (!user) {
    throw new ApiError('User not found.', 404);
  }

  return user as Omit<IUser, 'passwordHash'>;
};