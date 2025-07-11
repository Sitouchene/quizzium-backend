// src/routes/authRoutes.ts
import { Router } from 'express';
import { registerUser, loginUser, getMe } from '../controllers/authController';
//import { logOutUser } from '../controllers/authController';
import { protect } from '../middlewares/authMiddleware'; // Import the protect middleware

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
//router.post('/logout', logoutUser);

export default router;