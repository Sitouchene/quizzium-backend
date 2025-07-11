// src/routes/publicRoutes.ts
import { Router } from 'express';
import {
  getAllPublicQuizzes,
  getPublicQuizById,
  getPublicQuizBySlug
} from '../controllers/publicQuizController'; // Importe les fonctions du contrôleur public

const router = Router();

// Routes pour les quizzes accessibles au public (invités)
router.get('/quizzes', getAllPublicQuizzes);
router.get('/quizzes/:slug', getPublicQuizBySlug);  //router.get('/quizzes/:id', getPublicQuizById);

// Vous pouvez ajouter d'autres routes publiques ici à l'avenir
// Exemple: router.get('/trainings/public', getPublicTrainings);

export default router;
