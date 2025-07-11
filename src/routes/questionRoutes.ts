// src/routes/questionRoutes.ts
import { Router } from 'express';
import {
  createQuestion,
  getAllQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
} from '../controllers/questionController';
import { protect } from '../middlewares/authMiddleware';
import { authorize } from '../middlewares/roleMiddleware';

const router = Router();

// Base routes for questions
router.route('/')
  .post(protect, authorize(['manager', 'admin']), createQuestion) // Create question
  .get(protect, getAllQuestions); // Get all questions (answers excluded for students by default)

router.route('/:id')
  .get(protect, getQuestionById) // Get single question (answers excluded for students by default)
  .put(protect, authorize(['manager', 'admin']), updateQuestion) // Update question
  .delete(protect, authorize(['manager', 'admin']), deleteQuestion); // Delete question

// Nested route under chapters for questions (e.g., /api/chapters/:chapterId/questions)
// This will allow fetching questions specific to a chapter.
router.get('/by-chapter/:chapterId', protect, getAllQuestions);

export default router;