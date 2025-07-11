// src/routes/trainingRoutes.ts
import { Router } from 'express';
import {
  createTraining,
  getAllTrainings,
  addChaptersToTraining,
  addQuestionsToTraining,
  getTrainingById,
  updateTraining,
  deleteTraining,
  assignTeachers
} from '../controllers/trainingController';
import { protect } from '../middlewares/authMiddleware';
import { authorize } from '../middlewares/roleMiddleware';

const router = Router();


// Routes for Training CRUD (primarily for Managers/Admins to create/update/delete)
router.route('/')
  .post(protect, authorize(['manager', 'admin']), createTraining) // Create training
  .get(protect, getAllTrainings); // Get all trainings (accessible by all authenticated roles)

router.route('/:id')
  .get(protect, getTrainingById) // Get single training (accessible by all authenticated roles)
  .put(protect, authorize(['manager', 'admin']), updateTraining) // Update training
  .delete(protect, authorize(['manager', 'admin']), deleteTraining); // Delete training

// Routes for assigning/removing teachers from a training
router.route('/:id/assign-teachers').patch(protect, authorize(['manager', 'admin']), assignTeachers) // Assign teachers

// Route pour ajouter des chapitres à une formation
router.patch('/:id/add-chapters', protect, authorize(['teacher', 'manager', 'admin']), addChaptersToTraining);

// Nouvelle route pour ajouter des questions à une formation
router.patch('/:id/add-questions', protect, authorize(['teacher', 'manager', 'admin']), addQuestionsToTraining);

// Note: If you prefer to remove a single teacher via URL param, you'd add:
// router.delete('/:id/teachers/:teacherId', protect, authorize(['manager', 'admin']), removeSingleTeacherController);
// (Requires a specific controller for single removal, or adapting removeTeachers controller)

export default router;