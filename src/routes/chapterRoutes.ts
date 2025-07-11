// src/routes/chapterRoutes.ts
import { Router } from 'express';
import {
  createChapter,
  getAllChapters,
  getChapterById,
  updateChapter,
  deleteChapter,
} from '../controllers/chapterController';
import { protect } from '../middlewares/authMiddleware';
import { authorize } from '../middlewares/roleMiddleware';

const router = Router();

// Base routes for chapters
router.route('/')
  .post(protect, authorize(['manager', 'admin']), createChapter) // Create chapter
  .get(protect, getAllChapters); // Get all chapters

router.route('/:id')
  .get(protect, getChapterById) // Get single chapter
  .put(protect, authorize(['manager', 'admin']), updateChapter) // Update chapter
  .delete(protect, authorize(['manager', 'admin']), deleteChapter); // Delete chapter

// Nested route under trainings for chapters (e.g., /api/trainings/:trainingId/chapters)
// This will allow fetching chapters specific to a training.
// The `trainingId` is passed in `req.params` to `getAllChapters`.
router.get('/by-training/:trainingId', protect, getAllChapters);

export default router;