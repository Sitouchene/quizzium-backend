// src/controllers/authController.ts
import { Request, Response, NextFunction } from 'express';
import { registerUserService, loginUserService, getMyProfileService } from '../services/authService'; // Import getMyProfileService
import { ApiError } from '../utils/types'; // Make sure ApiError is imported

export const registerUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password, role, firstName, lastName } = req.body;
    const authResponse = await registerUserService({ username, email, password, role, firstName, lastName });
    res.status(201).json(authResponse);
  } catch (error) {
    next(error); // Pass error to the error handling middleware
  }
};

export const loginUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const authResponse = await loginUserService(email, password);
    res.status(200).json(authResponse);
  } catch (error) {
    next(error); // Pass error to the error handling middleware
  }
};

// Controller for fetching the authenticated user's profile
export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.user is populated by the `protect` middleware
    if (!req.user || !req.user.id) {
      // This should ideally be caught by `protect` middleware, but good for type safety
      return next(new ApiError('User not authenticated or ID missing.', 401));
    }

    const userProfile = await getMyProfileService(req.user.id);

    res.status(200).json(userProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    next(error); // Pass error to the error handling middleware
  }
};

/**
 * Log out user.
 * For stateless JWTs, this primarily signals the client to discard the token.
 * POST /api/auth/logout
 * (Optional: could implement token blacklisting for enhanced security if needed)

export const logoutUser = (req: Request, res: Response, next: NextFunction) => {
  try {
    // If you were using cookies for tokens, you would clear them here:
    // res.clearCookie('token'); // Assuming your token is in a cookie named 'token'

    // For a typical Authorization header (Bearer token) setup,
    // the server just sends a success message. The client is responsible
    // for removing the token from its storage (localStorage, sessionStorage, Vuex/Redux store, etc.).
    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (error) {
    next(error); // Pass any unexpected errors to the error handler
  }
};
 */