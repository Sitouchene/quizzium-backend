import { Request, Response, NextFunction } from 'express';
import {
  getAllUsersService,
  getUserByIdService,
  updateUserService, // For admin updates
  toggleUserActiveStatusService,
  deleteUserService,
  updateMyProfileService,
  GetUsersQueryParams
} from '../services/userService';
import { ApiError } from '../utils/types';
import { Types } from 'mongoose';

/**
 * Get all users with pagination, search, filter, and sort (Admin only).
 * GET /api/users?page=1&limit=10&search=john&role=student&isActive=true&sortBy=username&sortOrder=asc
 */
export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract query parameters from the request
    const queryParams: GetUsersQueryParams = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      search: req.query.search as string | undefined,
      role: req.query.role as GetUsersQueryParams['role'] | undefined, // Explicitly cast to the defined type
      isActive: req.query.isActive as GetUsersQueryParams['isActive'] | undefined, // Explicitly cast
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };

    const result = await getAllUsersService(queryParams);
    res.status(200).json(result); // Send the full result object
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single user by ID (Admin only).
 * GET /api/users/:id
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid user ID format.', 400));
    }

    const user = await getUserByIdService(id);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a user by ID (Admin only).
 * PUT /api/users/:id
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid user ID format.', 400));
    }

    if (Object.keys(updateData).length === 0) {
      return next(new ApiError('No update data provided.', 400));
    }

    const updatedUser = await updateUserService(id, updateData);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};

/**
 * Update the authenticated user's own profile.
 * PATCH /api/users/me
 * Allowed fields: profile subdocument fields.
 */
export const updateMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure req.user is available from the protect middleware
    if (!req.user || !req.user.id) {
      return next(new ApiError('Authentication required.', 401));
    }

    const userId = req.user.id;
    const updateData = req.body; // The service will filter allowed fields

    if (Object.keys(updateData).length === 0) {
      return next(new ApiError('No update data provided.', 400));
    }

    const updatedUser = await updateMyProfileService(userId, updateData);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};


/**
 * Activate or deactivate a user by ID (Admin only).
 * PATCH /api/users/:id/status
 * Body: { "isActive": true | false }
 */
export const toggleUserActiveStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid user ID format.', 400));
    }

    if (typeof isActive !== 'boolean') {
      return next(new ApiError('isActive status must be a boolean (true/false).', 400));
    }

    const updatedUser = await toggleUserActiveStatusService(id, isActive);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
};


/**
 * Delete a user by ID (Admin only).
 * DELETE /api/users/:id
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return next(new ApiError('Invalid user ID format.', 400));
    }

    const result = await deleteUserService(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};