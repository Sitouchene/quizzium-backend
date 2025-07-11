// src/routes/quizRoutes.ts
import { Router } from 'express';
import {
  createQuiz,
  updateQuiz,
  publishQuiz,
  getAllQuizzes,
  getQuizById,
  deleteQuiz,
} from '../controllers/quizController';
import { protect } from '../middlewares/authMiddleware'; // Assuming this provides req.user
import { authorize } from '../middlewares/roleMiddleware'; // Assuming this provides req.user.role

const router = Router();

// Routes pour la gestion des Quizzes
router.route('/')
  .post(protect, authorize(['student', 'teacher', 'admin', 'manager']), createQuiz) // Students for revision, teachers for formative/summative
  .get(protect, getAllQuizzes); // All authenticated roles can view (filtered by service)

router.route('/:id')
  .get(protect, getQuizById) // All authenticated roles can view (filtered by service)
  .put(protect, authorize(['student', 'teacher', 'admin', 'manager']), updateQuiz) // Student can update their revision quizzes; teachers/admins/managers can update others
  .delete(protect, authorize(['teacher', 'admin', 'manager']), deleteQuiz); // Teachers can delete their own unpublished, admins/managers can delete any

// Specific route for publishing/unpublishing a quiz
router.patch('/:id/publish', protect, authorize(['teacher', 'admin', 'manager']), publishQuiz);

// Nested routes for convenience (e.g., get quizzes for a specific training or creator)
router.get('/by-training/:trainingId', protect, getAllQuizzes); // Filters by trainingId
router.get('/by-creator/:creatorId', protect, getAllQuizzes); // Filters by creatorId

export default router;

