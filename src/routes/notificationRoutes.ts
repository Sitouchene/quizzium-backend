// src/routes/notificationRoutes.ts
import { Router } from 'express';
import {
  getMyNotifications,
  markNotificationAsRead,
  deleteNotification,
} from '../controllers/notificationControleller';
import { protect } from '../middlewares/authMiddleware'; // Assumed to populate req.user
import { authorize } from '../middlewares/roleMiddleware'; // Assumed to check req.user.role

const router = Router();

// Routes pour la gestion des Notifications
router.route('/')
  .get(protect, getMyNotifications); // Tout utilisateur authentifié peut récupérer ses notifications

router.route('/:id')
  .delete(protect, deleteNotification); // L'utilisateur peut supprimer ses propres notifications, ou admin/manager n'importe quelle

// Route spécifique pour marquer comme lue
router.patch('/:id/read', protect, markNotificationAsRead); // Tout utilisateur authentifié peut marquer ses notifications comme lues

export default router;

