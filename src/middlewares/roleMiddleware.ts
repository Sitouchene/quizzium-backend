// src/middlewares/roleMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { ApiError, UserRole } from '../utils/types';

/**
 * Middleware to restrict access based on user roles.
 * @param allowedRoles An array of roles that are allowed to access the route.
 */
export const authorize = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Ensure req.user is set by the protect middleware first
    if (!req.user || !req.user.role) {
      return next(new ApiError('Not authorized to access this resource: User role not found.', 403));
    }

    // Check if the user's role is in the allowedRoles array
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(`Role '${req.user.role}' is not authorized to access this resource. Required roles: ${allowedRoles.join(', ')}.`, 403));
    }

    next(); // User has an allowed role, proceed to the next middleware/controller
  };
};