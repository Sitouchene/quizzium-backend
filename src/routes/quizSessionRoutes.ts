// src/routes/quizSessionRoutes.ts
import { Router } from 'express';
import {
  startQuizSession,
  submitQuizSession,
  getAllQuizSessions,
  getQuizSessionById,
  deleteQuizSession,
} from '../controllers/quizSessionController';
import { protect } from '../middlewares/authMiddleware';
import { authorize } from '../middlewares/roleMiddleware';

const router = Router();

// Routes for QuizSession management
router.post('/start', protect, authorize(['student']), startQuizSession); // Student starts a quiz session
router.put('/:id/submit', protect, authorize(['student']), submitQuizSession); // Student submits quiz answers

router.route('/')
  .get(protect, getAllQuizSessions); // All authenticated roles can view sessions (filtered by service)

router.route('/:id')
  .get(protect, getQuizSessionById) // All authenticated roles can view single session (filtered by service)
  .delete(protect, authorize(['student', 'manager', 'admin']), deleteQuizSession); // Student can delete their own incomplete; Manager/Admin can delete any

// Nested routes for convenience (e.g., get sessions for a specific quiz or user)
router.get('/by-quiz/:quizId', protect, getAllQuizSessions); // Filters by quizId
router.get('/by-user/:userId', protect, getAllQuizSessions); // Filters by userId

export default router;

