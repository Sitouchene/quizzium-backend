//src/app.ts
import express from 'express';
import cors from 'cors';
import {errorHandler} from './middlewares/errorHandler';

const app = express();
// Middlewares globaux
app.use(express.json()); // Pour parser les corps de requête JSON
// Configure CORS to allow requests from your Next.js frontend
const corsOptions = {
  origin: function (origin, callback) {
    // En développement, accepter toutes les origines localhost
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('::1')) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par CORS'));
    }
  },// Allow only your Next.js app's origin
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Allow cookies to be sent (if you use them later for auth)
  optionsSuccessStatus: 204 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions)); // Use CORS middleware with options

// Route de test simple (endpoint de santé)
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Backend is healthy!' });
});

// Importation et utilisation des routes API 
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import trainingRoutes from './routes/trainingRoutes';
import chapterRoutes from './routes/chapterRoutes'; 
import questionRoutes from './routes/questionRoutes'; 
import enrollmentRoutes from './routes/enrollmentRoutes';
import quizRoutes from './routes/quizRoutes'; 
import quizSessionRoutes from './routes/quizSessionRoutes'; 
import notificationRoutes from './routes/notificationRoutes'; 
import publicRoutes from './routes/publicRoutes';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/chapters', chapterRoutes); 
app.use('/api/questions', questionRoutes); 
app.use('/api/enrollments', enrollmentRoutes); 
app.use('/api/quizzes', quizRoutes);
app.use('/api/quiz-sessions', quizSessionRoutes);
app.use('/api/notifications', notificationRoutes); 
app.use('/api/public', publicRoutes); 


app.use(errorHandler);
export default app;