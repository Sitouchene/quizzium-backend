// src/services/quizService.ts
import { Quiz, IQuiz, IQuestionWithScore } from '../models/Quiz';
import { Training, ITraining } from '../models/Training';
import { User, IUser } from '../models/User';
// Importe IQuestion et MediaType depuis le modèle Question
import { Question, IQuestion } from '../models/Question'; 
// Assurez-vous d'importer QuestionType ici
import { ApiError, ILocalizedString, UserRole, QuizType, QuestionType,MediaType } from '../utils/types'; 
import { Types } from 'mongoose';
import { Chapter } from '../models/Chapter';

// --- Définition de l'ID de la formation générale via les variables d'environnement ---
const GENERAL_TRAINING_ID = process.env.GENERAL_TRAINING_ID;

// Vérification au démarrage pour s'assurer que l'ID de la formation générale est configuré
if (!GENERAL_TRAINING_ID || !Types.ObjectId.isValid(GENERAL_TRAINING_ID)) {
  console.error('CRITICAL ERROR: GENERAL_TRAINING_ID is not defined or is not a valid ObjectId in environment variables. Please set it in your .env file.');
  // En production, vous pourriez vouloir arrêter l'application ici pour éviter des comportements imprévus.
  // process.exit(1); 
}

// --- Interfaces pour les données d'entrée des services ---

// Données pour la création d'un quiz
interface CreateQuizData {
  trainingId: string;
  title: ILocalizedString;
  description?: ILocalizedString;
  thumbnailUrl?: string;
  creatorId: string;
  quizType: QuizType; // Utilise l'enum QuizType
  deadline?: Date;
  slug:string;
  durationMinutes?: number;
  globalScore: number;
  allowedAttempts?: number;
  tags?: string[];
  // Options pour la génération/sélection des questions
  questionsConfig?: {
    method: 'generate' | 'select'; // Méthode de sélection des questions
    chapterIds?: string[]; // Pour la génération aléatoire
    numberOfQuestions?: number; // Pour la génération aléatoire
    difficulty?: 'easy' | 'medium' | 'hard'; // Pour la génération aléatoire (Type littéral string)
    selectedQuestionIdsWithScores?: Array<{ questionId: string; score?: number }>; // Pour la sélection manuelle
  };
  isPublic?: boolean; 
}

// Données pour la mise à jour d'un quiz
interface UpdateQuizData {
  title?: ILocalizedString;
  description?: ILocalizedString;
  thumbnailUrl?: string;
  deadline?: Date;
  isPublished?: boolean; 
  durationMinutes?: number;
  globalScore?: number;
  allowedAttempts?: number;
  tags?: string[];
  // Permet de modifier la liste des questions ou leurs scores
  questions?: Array<{ questionId: string; score: number }>;
  isPublic?: boolean; 
}

/**
 * Génère une liste de questions basées sur les chapitres et le nombre spécifiés.
 * @param chapterIds IDs des chapitres à partir desquels générer les questions.
 * @param numberOfQuestions Nombre de questions à générer.
 * @param difficulty Difficulté optionnelle des questions.
 * @returns Un tableau d'objets IQuestionWithScore (avec score par défaut de 1).
 * @throws ApiError si les chapitres sont introuvables ou pas assez de questions disponibles.
 */
const generateQuestionsForQuiz = async (
  chapterIds: string[],
  numberOfQuestions: number,
  difficulty?: 'easy' | 'medium' | 'hard' // Type littéral string
): Promise<IQuestionWithScore[]> => {
  if (!chapterIds || chapterIds.length === 0) {
    throw new ApiError('Chapter IDs are required for question generation.', 400);
  }
  if (!numberOfQuestions || numberOfQuestions <= 0) {
    throw new ApiError('Number of questions must be positive for generation.', 400);
  }

  const query: any = { chapter: { $in: chapterIds.map(id => new Types.ObjectId(id)) } };
  if (difficulty) {
    query.difficulty = difficulty;
  }

  const questions = await Question.aggregate([
    { $match: query },
    { $sample: { size: numberOfQuestions } }
  ]);

  if (questions.length < numberOfQuestions) {
    throw new ApiError(`Could not find ${numberOfQuestions} questions for the specified criteria. Found ${questions.length}.`, 400);
  }

  return questions.map(q => ({
    questionId: q._id,
    score: 1, 
  }));
};

/**
 * Crée un nouveau quiz.
 * Gère la génération ou la sélection manuelle des questions.
 * @param data Les données pour la création du quiz.
 * @returns Le document Quiz créé.
 * @throws ApiError en cas de validation ou d'erreur de base de données.
 */
export const createQuizService = async (data: CreateQuizData): Promise<IQuiz> => {
  const {
    trainingId,
    title,
    description,
    creatorId,
    quizType,
    slug,
    deadline,
    durationMinutes,
    globalScore,
    allowedAttempts,
    tags,
    questionsConfig,
    thumbnailUrl,
    isPublic 
  } = data;

  const creator = await User.findById(creatorId);
  if (!creator) {
    throw new ApiError('Creator not found.', 404);
  }

  if (creator.role === UserRole.STUDENT && quizType !== QuizType.REVISION) {
    throw new ApiError('Students can only create revision quizzes.', 403);
  }
  if (creator.role === UserRole.TEACHER && quizType === QuizType.REVISION) {
    throw new ApiError('Teachers cannot create revision quizzes.', 403); 
  }
  if (![UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER, UserRole.STUDENT].includes(creator.role)) {
    throw new ApiError('Unauthorized role for creating quizzes.', 403);
  }

  const training = await Training.findById(trainingId);
  if (!training) {
    throw new ApiError('Training not found.', 404);
  }

  let quizQuestions: IQuestionWithScore[] = [];
  if (questionsConfig?.method === 'generate') {
    if (!questionsConfig.chapterIds || questionsConfig.chapterIds.length === 0 || !questionsConfig.numberOfQuestions) {
      throw new ApiError('Chapter IDs and number of questions are required for question generation.', 400);
    }
    quizQuestions = await generateQuestionsForQuiz(
      questionsConfig.chapterIds,
      questionsConfig.numberOfQuestions,
      questionsConfig.difficulty
    );
  } else if (questionsConfig?.method === 'select') {
    if (!questionsConfig.selectedQuestionIdsWithScores || questionsConfig.selectedQuestionIdsWithScores.length === 0) {
      throw new ApiError('Selected question IDs are required for manual selection.', 400);
    }
    const questionIds = questionsConfig.selectedQuestionIdsWithScores.map(q => new Types.ObjectId(q.questionId));
    const existingQuestions = await Question.find({ _id: { $in: questionIds } }).lean();
    if (existingQuestions.length !== questionIds.length) {
      throw new ApiError('One or more selected questions not found.', 400);
    }
    quizQuestions = questionsConfig.selectedQuestionIdsWithScores.map(q => ({
      questionId: new Types.ObjectId(q.questionId),
      score: q.score !== undefined ? q.score : 1, 
    }));
  } else {
    throw new ApiError('A valid question configuration method (generate or select) is required.', 400);
  }

  const isPublished = (creator.role === UserRole.STUDENT && quizType === QuizType.REVISION) ? false : false; 
  const publishedAt = isPublished ? new Date() : undefined;

  const newQuiz = new Quiz({
    training: new Types.ObjectId(trainingId),
    title,
    thumbnailUrl:thumbnailUrl||null,
    slug,
    description,
    creator: new Types.ObjectId(creatorId),
    quizType, 
    deadline: deadline || null,
    isPublished: isPublished,
    publishedAt: publishedAt,
    durationMinutes: durationMinutes || null,
    questions: quizQuestions,
    globalScore,
    allowedAttempts: allowedAttempts || null,
    tags: tags || [],
    isPublic: isPublic || false,
  });

  try {
    const savedQuiz = await newQuiz.save();
    training.quizzes.push(savedQuiz._id);
    await training.save();
    return savedQuiz;
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to create quiz: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Met à jour un quiz existant.
 * Seul le créateur ou un admin/manager peut modifier.
 * Les champs comme `isPublished` sont gérés par `publishQuizService`.
 * @param quizId L'ID du quiz à mettre à jour.
 * @param data Les données de mise à jour.
 * @param requestingUser L'utilisateur qui fait la requête.
 * @returns Le document Quiz mis à jour.
 * @throws ApiError en cas d'erreur ou d'autorisation.
 */
export const updateQuizService = async (
  quizId: string,
  data: UpdateQuizData,
  requestingUser: { id: string; role: UserRole }
): Promise<IQuiz> => {
  if (!Types.ObjectId.isValid(quizId)) {
    throw new ApiError('Invalid quiz ID format.', 400);
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new ApiError('Quiz not found.', 404);
  }

  const isCreator = quiz.creator.toString() === requestingUser.id;
  const isAdminOrManager = [UserRole.ADMIN, UserRole.MANAGER].includes(requestingUser.role);

  if (!isCreator && !isAdminOrManager) {
    throw new ApiError('Not authorized to update this quiz.', 403);
  }

  if (quiz.isPublished && !isAdminOrManager) {
    const sensitiveFields = ['questions', 'globalScore', 'quizType', 'durationMinutes', 'allowedAttempts'];
    const changesToSensitiveFields = sensitiveFields.some(field => (data as any)[field] !== undefined);
    if (changesToSensitiveFields) {
      throw new ApiError('Cannot update sensitive fields of a published quiz.', 403);
    }
  }

  if (data.title) quiz.title = data.title;
  if (data.description) quiz.description = data.description;
  if (data.deadline !== undefined) quiz.deadline = data.deadline;
  if (data.durationMinutes !== undefined) quiz.durationMinutes = data.durationMinutes;
  if (data.globalScore !== undefined) quiz.globalScore = data.globalScore;
  if (data.allowedAttempts !== undefined) quiz.allowedAttempts = data.allowedAttempts;
  if (data.tags) quiz.tags = data.tags;
  if (data.isPublic !== undefined) quiz.isPublic = data.isPublic;

  if (data.questions) {
    if (data.questions.length === 0) {
      throw new ApiError('Quiz must contain at least one question.', 400);
    }
    const questionIds = data.questions.map(q => new Types.ObjectId(q.questionId));
    const existingQuestions = await Question.find({ _id: { $in: questionIds } }).lean();
    if (existingQuestions.length !== questionIds.length) {
      throw new ApiError('One or more provided question IDs are invalid.', 400);
    }
    quiz.questions = data.questions.map(q => ({
      questionId: new Types.ObjectId(q.questionId),
      score: q.score,
    }));
  }

  try {
    await quiz.save();
    return quiz;
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to update quiz: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Publie ou dépublie un quiz.
 * Seuls les enseignants, admins ou managers peuvent effectuer cette action.
 * Un quiz de révision ne peut pas être publié.
 * @param quizId L'ID du quiz.
 * @param publishStatus Le nouveau statut de publication (true/false).
 * @param requestingUser L'utilisateur qui fait la requête.
 * @returns Le document Quiz mis à jour.
 * @throws ApiError en cas d'erreur ou d'autorisation.
*/
export const publishQuizService = async (
  quizId: string,
  publishStatus: boolean,
  requestingUser: { id: string; role: UserRole }
): Promise<IQuiz> => {
  if (!Types.ObjectId.isValid(quizId)) {
    throw new ApiError('Invalid quiz ID format.', 400);
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new ApiError('Quiz not found.', 404);
  }

  const isCreatorTeacher = quiz.creator.toString() === requestingUser.id && requestingUser.role === UserRole.TEACHER;
  const isAdminOrManager = [UserRole.ADMIN, UserRole.MANAGER].includes(requestingUser.role);

  if (!isCreatorTeacher && !isAdminOrManager) {
    throw new ApiError('Not authorized to publish/unpublish this quiz.', 403);
  }

  if (quiz.quizType === QuizType.REVISION && publishStatus === true) {
    throw new ApiError('Revision quizzes cannot be published.', 400);
  }

  if (publishStatus && quiz.isPublished) {
    throw new ApiError('Quiz is already published.', 400);
  }
  if (!publishStatus && !quiz.isPublished) {
    throw new ApiError('Quiz is already unpublished.', 400);
  }

  quiz.isPublished = publishStatus;
  quiz.publishedAt = publishStatus ? new Date() : undefined;

  try {
    await quiz.save();
    return quiz;
  } catch (error: any) {
    throw new ApiError(`Failed to update quiz publication status: ${error.message || 'Unknown error'}`, 500);
  }
};


/**
 * Récupère tous les quizzes en fonction des filtres et des autorisations.
 * @param filters Filtres de recherche.
 * @param options Options de pagination et de population.
 * @param requestingUser L'utilisateur qui fait la requête.
 * @returns Un tableau de documents Quiz.
 */
export const getAllQuizzesService = async (
  filters: any = {},
  options: { page?: number; limit?: number; populateCreator?: boolean; populateTraining?: boolean } = {},
  requestingUser: { id: string; role: UserRole }
): Promise<IQuiz[]> => {
  const { page = 1, limit = 10, populateCreator = false, populateTraining = false } = options;
  const skip = (page - 1) * limit;

  let queryFilters: any = { ...filters };

  // Apply authorization filters
  if (requestingUser.role === UserRole.STUDENT) {
    // Students can see published quizzes (not public) AND their own revision quizzes AND quizzes from the GENERAL_TRAINING_ID
    queryFilters.$or = [
      { isPublished: true, isPublic: false }, // Published but not public (includes general training quizzes implicitly if they are in the general training)
      { creator: new Types.ObjectId(requestingUser.id), quizType: QuizType.REVISION },
      // Added condition for General Training quizzes
      { training: new Types.ObjectId(GENERAL_TRAINING_ID!), isPublished: true, isPublic: false }
    ];
  } else if (requestingUser.role === UserRole.TEACHER) {
    // Teachers can see their own quizzes (published or not) and all published quizzes (not public) AND quizzes from GENERAL_TRAINING_ID
    queryFilters.$or = [
      { creator: new Types.ObjectId(requestingUser.id) },
      { isPublished: true, isPublic: false },
      // Added condition for General Training quizzes
      { training: new Types.ObjectId(GENERAL_TRAINING_ID!), isPublished: true, isPublic: false }
    ];
  }
  // Admins and Managers see all by default, no additional filter needed based on role here

  let query = Quiz.find(queryFilters).sort({ createdAt: -1 });

  if (populateCreator) query = query.populate('creator', 'username profile.firstName profile.lastName');
  if (populateTraining) query = query.populate('training', 'title slug');

  // Si on veut inclure les médias dans le getAll, il faut spécifier les champs ici
  // question.mediaType, question.mediaUrl, question.mediaAltText
  // question.choices.choiceMediaType, question.choices.choiceMediaUrl, question.choices.choiceMediaAltText
  // Mais par défaut, getAll ne peuple pas les questions, donc pas de changement direct ici.
  // Ce serait si vous aviez un populate('questions') dans le getAll par défaut.

  const quizzes = await query.skip(skip).limit(limit).lean();
  return quizzes;
};

/**
 * Récupère un quiz spécifique par ID.
 * @param quizId L'ID du quiz.
 * @param options Options de population.
 * @param requestingUser L'utilisateur qui fait la requête.
 * @returns Le document Quiz.
 * @throws ApiError si le quiz n'est pas trouvé ou non autorisé.
 */
export const getQuizByIdService = async (
  quizId: string,
  options: { populateCreator?: boolean; populateTraining?: boolean; populateQuestions?: boolean } = {},
  requestingUser: { id: string; role: UserRole }
): Promise<IQuiz> => {
  if (!Types.ObjectId.isValid(quizId)) {
    throw new ApiError('Invalid quiz ID format.', 400);
  }

  let query = Quiz.findById(quizId);

  if (populateCreator) query = query.populate('creator', 'username profile.firstName profile.lastName');
  if (populateTraining) query = query.populate('training', 'title slug');
  // MODIFIÉ ICI pour inclure les champs de média
  if (populateQuestions) {
    query = query.populate('questions.questionId', 
      'text type choices.text choices.isCorrect correctAnswerFormula difficulty explanation ' +
      'mediaType mediaUrl mediaAltText ' + // Champs média de la question
      'choices.choiceMediaType choices.choiceMediaUrl choices.choiceMediaAltText'); // Champs média des choix
  }

  const quiz = await query.lean();

  if (!quiz) {
    throw new ApiError('Quiz not found.', 404);
  }

  // Authorization check for single quiz access
  const isCreator = quiz.creator.toString() === requestingUser.id;
  const isAdminOrManager = [UserRole.ADMIN, UserRole.MANAGER].includes(requestingUser.role);

  if (!quiz.isPublic) { 
    const isGeneralTrainingQuiz = quiz.training.toString() === GENERAL_TRAINING_ID && quiz.isPublished;

    if (!isGeneralTrainingQuiz) { 
      if (!quiz.isPublished && !isCreator && !isAdminOrManager) {
        throw new ApiError('Not authorized to view this quiz.', 403);
      }

      if (requestingUser.role === UserRole.STUDENT && !quiz.isPublished && !(isCreator && quiz.quizType === QuizType.REVISION)) {
        throw new ApiError('Not authorized to view this quiz.', 403);
      }

      if (requestingUser.role === UserRole.TEACHER && !quiz.isPublished && !isCreator) {
        throw new ApiError('Not authorized to view this quiz.', 403);
      }
    }
  }

  return quiz;
};

/**
 * Supprime un quiz.
 * Seuls le créateur (si non publié) ou un admin/manager peuvent supprimer.
 * @param quizId L'ID du quiz à supprimer.
 * @param requestingUser L'utilisateur qui fait la requête.
 * @returns Message de succès.
 * @throws ApiError si le quiz n'est pas trouvé ou non autorisé.
 */
export const deleteQuizService = async (
  quizId: string,
  requestingUser: { id: string; role: UserRole }
): Promise<{ message: string }> => {
  if (!Types.ObjectId.isValid(quizId)) {
    throw new ApiError('Invalid quiz ID format.', 400);
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    throw new ApiError('Quiz not found or already deleted.', 404);
  }

  const isCreator = quiz.creator.toString() === requestingUser.id;
  const isAdminOrManager = [UserRole.ADMIN, UserRole.MANAGER].includes(requestingUser.role);

  if (!isAdminOrManager) {
    if (quiz.isPublished) {
      throw new ApiError('Published quizzes can only be deleted by admin/manager.', 403);
    }
    if (!isCreator) {
      throw new ApiError('Not authorized to delete this quiz.', 403);
    }
  }

  try {
    await Training.updateOne(
      { _id: quiz.training },
      { $pull: { quizzes: quiz._id } }
    );
    await Quiz.deleteOne({ _id: quizId });
    return { message: 'Quiz deleted successfully.' };
  } catch (error: any) {
    throw new ApiError(`Failed to delete quiz: ${error.message || 'Unknown error'}`, 500);
  }
};


/**
 * Récupère tous les quizzes marqués comme publics et publiés, avec pagination.
 * Ces quizzes sont accessibles sans authentification.
 * @param options Options de pagination.
 * @returns Un tableau de documents Quiz publics.
 */
export const getPublicQuizzesService = async (
  options: { page?: number; limit?: number } = {}
): Promise<IQuiz[]> => {
  try { 
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const queryFilters: any = { isPublic: true, isPublished: true };

    const quizzes = await Quiz.find(queryFilters).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    return quizzes;
  } catch (error: any) { 
    if (error.name === 'CastError' && error.path === '_id') { 
        throw new ApiError('Invalid quiz ID format.', 400);
    }
    if (error instanceof ApiError) {
        throw error;
    }
    throw new ApiError(`Failed to retrieve public quizzes: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Récupère un quiz spécifique par ID s'il est marqué comme public et est publié.
 * Accessible sans authentification. Inclut les bonnes réponses pour le scoring côté client.
 * @param quizId L'ID du quiz.
 * @returns Le document Quiz public avec les informations de réponse.
 * @throws ApiError si le quiz n'est pas trouvé, n'est pas public ou n'est pas publié.
 */
export const getPublicQuizByIdService = async (quizId: string): Promise<IQuiz> => {
  try { 
    if (!Types.ObjectId.isValid(quizId)) {
      throw new ApiError('Invalid quiz ID format.', 400);
    }

    // Peupler les questions en incluant les bonnes réponses pour le scoring côté client
    // et MAINTENANT les champs média
    const quiz = await Quiz.findOne({ _id: quizId, isPublic: true, isPublished: true })
                           .populate('questions.questionId', 
                             'text type choices.text choices.isCorrect correctAnswerFormula difficulty tags ' +
                             'mediaType mediaUrl mediaAltText ' + // Champs média de la question
                             'choices.choiceMediaType choices.choiceMediaUrl choices.choiceMediaAltText') // Champs média des choix
                           .lean();

    if (!quiz) {
      throw new ApiError('Public quiz not found or not accessible.', 404);
    }

    // Assurer que seules les informations nécessaires sont envoyées, même si le populate est large
    if (quiz.questions && quiz.questions.length > 0) {
      quiz.questions = quiz.questions.map(qItem => {
        const questionDoc = qItem.questionId as IQuestion;
        if (questionDoc) {
          const publicQuestion: Partial<IQuestion> = {
            _id: questionDoc._id,
            text: questionDoc.text,
            type: questionDoc.type,
            difficulty: questionDoc.difficulty,
            tags: questionDoc.tags,
            correctAnswerFormula: questionDoc.correctAnswerFormula, // Pour les questions de type Calcul
            // NOUVEAU: Inclure les champs de média pour la question
            mediaType: questionDoc.mediaType,
            mediaUrl: questionDoc.mediaUrl,
            mediaAltText: questionDoc.mediaAltText,
          };

          if (questionDoc.type === QuestionType.QCM && questionDoc.choices) {
            // Inclure les choix avec isCorrect et NOUVEAU: leurs médias
            (publicQuestion as any).choices = questionDoc.choices.map(choice => ({
              text: choice.text,
              isCorrect: choice.isCorrect, 
              // NOUVEAU: Inclure les champs de média pour le choix
              choiceMediaType: choice.choiceMediaType,
              choiceMediaUrl: choice.choiceMediaUrl,
              choiceMediaAltText: choice.choiceMediaAltText,
            }));
          }
          return {
            questionId: publicQuestion,
            score: qItem.score,
          };
        }
        return qItem;
      });
    }

    return quiz;
  } catch (error: any) { 
    if (error.name === 'CastError' && error.path === '_id') { 
        throw new ApiError('Invalid quiz ID format.', 400);
    }
    if (error instanceof ApiError) {
        throw error;
    }
    throw new ApiError(`Failed to retrieve public quiz: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Récupère un quiz public par son slug, avec une limite optionnelle sur le nombre de questions.
 * @param slug Le slug du quiz.
 * @param limit Le nombre de questions à retourner.
 * @returns Le document Quiz public avec un nombre limité de questions aléatoires.
 */
export const getPublicQuizBySlugService = async (slug: string, limit?: number): Promise<IQuiz> => {
  try {
    const quiz = await Quiz.findOne({ slug: slug, isPublic: true, isPublished: true }).lean();

    if (!quiz) {
      throw new ApiError('Public quiz not found or not accessible.', 404);
    }
    
    // Si une limite est spécifiée, on sélectionne un échantillon aléatoire de questions
    if (limit && quiz.questions && quiz.questions.length > limit) {
      const allQuestions = quiz.questions;
      const sampledQuestions = [];
      const usedIndices = new Set();
      while (sampledQuestions.length < limit) {
        const randomIndex = Math.floor(Math.random() * allQuestions.length);
        if (!usedIndices.has(randomIndex)) {
          sampledQuestions.push(allQuestions[randomIndex]);
          usedIndices.add(randomIndex);
        }
      }
      quiz.questions = sampledQuestions;
    }

    // Peuple les questions sélectionnées avec leurs détails
    const populatedQuiz = await Quiz.populate(quiz, {
      path: 'questions.questionId',
      model: 'Question',
    });

    return populatedQuiz as IQuiz;

  } catch (error: any) { 
    if (error instanceof ApiError) {
        throw error;
    }
    throw new ApiError(`Failed to retrieve public quiz: ${error.message || 'Unknown error'}`, 500);
  }
};

