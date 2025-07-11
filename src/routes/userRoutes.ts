import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  updateUser,
  toggleUserActiveStatus,
  deleteUser,
  updateMyProfile, // <--- NEW IMPORT: For user self-updates
} from '../controllers/userController';
import { protect } from '../middlewares/authMiddleware'; // For authentication
import { authorize } from '../middlewares/roleMiddleware'; // For role-based authorization

const router = Router();

// Routes for authenticated user to manage their own profile
// IMPORTANT: This route should come BEFORE any /:id routes to avoid 'me' being interpreted as an ID.
router.patch('/me', protect, updateMyProfile); // <--- NEW ROUTE: Update authenticated user's profile

// All user management routes requiring admin role
router.route('/')
  .get(protect, authorize(['admin']), getAllUsers); // GET all users

router.route('/:id')
  .get(protect, authorize(['admin']), getUserById)    // GET single user by ID
  .put(protect, authorize(['admin']), updateUser)     // UPDATE user by ID
  .delete(protect, authorize(['admin']), deleteUser); // DELETE user by ID

router.patch('/:id/status', protect, authorize(['admin']), toggleUserActiveStatus);

export default router;