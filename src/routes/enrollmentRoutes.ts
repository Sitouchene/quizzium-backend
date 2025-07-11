// src/routes/enrollmentRoutes.ts
import { Router } from 'express';
import {
  createEnrollment,
  getAllEnrollments,
  getEnrollmentById,
  updateEnrollment,
  deleteEnrollment,
  completeChapter, // <-- Nom correct importé depuis le contrôleur
} from '../controllers/enrollmentController';
import { protect } from '../middlewares/authMiddleware';
import {UserRole} from '../utils/types'
import { authorize } from '../middlewares/roleMiddleware';

const router = Router();

// Routes for Enrollment CRUD
router.route('/')
  .post(protect, createEnrollment) // Student can enroll themselves, Manager/Admin can enroll others
  .get(protect, getAllEnrollments); // All authenticated roles can get enrollments (filtered by service)

router.route('/:id')
  .get(protect, getEnrollmentById) // All authenticated roles can get enrollment by ID (filtered by service)
  .put(protect, updateEnrollment) // Student can update own progress, Manager/Admin can update all
  .delete(protect, authorize([UserRole.MANAGER, UserRole.ADMIN]), deleteEnrollment); // Only Manager/Admin can delete

// Specific route for student progress updates
router.patch('/:id/progress', protect, authorize([UserRole.STUDENT]), completeChapter); // <-- Utilisation du nom correct

// Nested routes for convenience (e.g., get enrollments for a specific user or training)
router.get('/by-user/:userId', protect, getAllEnrollments); // Filters by userId from params
router.get('/by-training/:trainingId', protect, getAllEnrollments); // Filters by trainingId from params

export default router;
