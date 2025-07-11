import { User, IUser, IProfile } from '../models/User';
import { ApiError, UserRole } from '../utils/types';
import { hashPassword } from '../utils/password'; 
import { SortOrder } from 'mongoose'; 


// Interfaces pour les paramètres de requête de recherche
export interface GetUsersQueryParams {
  page?: number;
  limit?: number;
  search?: string; // Pour la recherche par username, email, firstName, lastName
  role?: UserRole | 'all'; // Filtrer par rôle, 'all' pour tous les rôles
  isActive?: 'true' | 'false' | 'all'; // Filtrer par statut actif/inactif
  sortBy?: string; // Champ pour le tri (ex: 'username', 'createdAt', 'lastLogin')
  sortOrder?: 'asc' | 'desc'; // Ordre de tri
}
// Interfaces pour les paramètres de pagination ---
interface PaginatedUsersResult {
  users: Omit<IUser, 'passwordHash'>[];
  totalUsers: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}
//Interface for admin updates
interface UserUpdateData { 
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  profile?: IProfile;
  isActive?: boolean;
}

// Interface for fields a user can update on their own profile
interface MyProfileUpdateData {
  profile?: Partial<IProfile>; // Allows partial updates to the profile subdocument
}

/**
 * Retrieves users from the database with pagination, search, filter, and sort capabilities.
 * @param queryParams Parameters for pagination, search, filter, and sort.
 * @returns A promise that resolves to an object containing users, total count, and pagination info.
 */
export const getAllUsersService = async (queryParams: GetUsersQueryParams = {}): Promise<PaginatedUsersResult> => {
  const {
    page = 1,
    limit = 10,
    search,
    role,
    isActive,
    sortBy = 'createdAt', // Default sort by creation date
    sortOrder = 'desc'    // Default sort order descending
  } = queryParams;

  const skip = (page - 1) * limit;
  const query: any = {};

  // Apply search filter
  if (search) {
    const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
    query.$or = [
      { username: searchRegex },
      { email: searchRegex },
      { 'profile.firstName': searchRegex },
      { 'profile.lastName': searchRegex },
    ];
  }

  // Apply role filter
  if (role && role !== 'all') {
    query.role = role;
  }

  // Apply isActive filter
  if (isActive && isActive !== 'all') {
    query.isActive = isActive === 'true'; // Convert 'true'/'false' string to boolean
  }

  // Count total users matching the query (without pagination)
  const totalUsers = await User.countDocuments(query);

  // Define sort options
  const sortOptions: { [key: string]: SortOrder } = {};
  if (sortBy) {
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
  }


  // Fetch users with pagination and sorting
  const users = await User.find(query)
    .select('-passwordHash') // Exclude password hash
    .sort(sortOptions)       // Apply sorting
    .skip(skip)              // Skip documents for pagination
    .limit(limit)            // Limit documents per page
    .lean();                 // Return plain JavaScript objects

  return {
    users,
    totalUsers,
    totalPages: Math.ceil(totalUsers / limit),
    currentPage: page,
    limit,
  };
};


/*
export const getAllUsersService = async (): Promise<Omit<IUser, 'passwordHash'>[]> => {
  const users = await User.find().select('-passwordHash').lean();
  return users;
};
*/





/**
 * Retrieves a single user by ID.
 * @param userId The ID of the user to retrieve.
 * @returns A promise that resolves to a user document, excluding password hash.
 * @throws ApiError if the user is not found.
 */
export const getUserByIdService = async (userId: string): Promise<Omit<IUser, 'passwordHash'>> => {
  const user = await User.findById(userId).select('-passwordHash').lean();
  if (!user) {
    throw new ApiError('User not found.', 404);
  }
  return user;
};

/**
 * Updates a user's information by ID (Admin only).
 * @param userId The ID of the user to update.
 * @param updateData The data to update (username, email, password, role, profile, isActive).
 * @returns A promise that resolves to the updated user document, excluding password hash.
 * @throws ApiError if the user is not found or update fails due to validation.
 */
export const updateUserService = async (userId: string, updateData: UserUpdateData): Promise<Omit<IUser, 'passwordHash'>> => {
  const { password, ...rest } = updateData;
  const updateFields: any = { ...rest };

  if (password) {
    updateFields.passwordHash = await hashPassword(password);
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updateFields },
    { new: true, runValidators: true }
  ).select('-passwordHash').lean();

  if (!updatedUser) {
    throw new ApiError('User not found or could not be updated.', 404);
  }

  return updatedUser;
};

// NEW: Service to update an authenticated user's own profile
export const updateMyProfileService = async (
  userId: string,
  updateData: MyProfileUpdateData
): Promise<Omit<IUser, 'passwordHash'>> => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError('User not found.', 404);
  }

  // Handle profile subdocument updates
  if (updateData.profile) {
    user.profile = { ...user.profile, ...updateData.profile };
  }

  // Save the updated user document
  await user.save({ validateBeforeSave: true });

  // Return the updated user, excluding the password hash
  // Using .lean() here won't work correctly after .save() unless you re-fetch
  // Better to convert the Mongoose document to a plain object
  const updatedUserObject = user.toObject();
  delete updatedUserObject.passwordHash;
  return updatedUserObject;
};


/**
 * Toggles the isActive status of a user.
 * @param userId The ID of the user to activate/deactivate.
 * @param activate A boolean indicating whether to activate (true) or deactivate (false) the user.
 * @returns A promise that resolves to the updated user document, excluding password hash.
 * @throws ApiError if the user is not found.
 */
export const toggleUserActiveStatusService = async (
  userId: string,
  activate: boolean
): Promise<Omit<IUser, 'passwordHash'>> => {
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: { isActive: activate } },
    { new: true, runValidators: true }
  ).select('-passwordHash').lean();

  if (!updatedUser) {
    throw new ApiError('User not found or could not update active status.', 404);
  }

  return updatedUser;
};


/**
 * Deletes a user by ID.
 * @param userId The ID of the user to delete.
 * @returns A promise that resolves when the user is successfully deleted.
 * @throws ApiError if the user is not found.
 */
export const deleteUserService = async (userId: string): Promise<{ message: string }> => {
  const result = await User.findByIdAndDelete(userId);
  if (!result) {
    throw new ApiError('User not found or could not be deleted.', 404);
  }
  return { message: 'User deleted successfully.' };
};