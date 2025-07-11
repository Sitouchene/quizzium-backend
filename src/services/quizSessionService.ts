// src/services/quizSessionService.ts
import { QuizSession, IQuizSession, IQuestionResponse , IClientQuestion} from '../models/QuizSession';
import { Question, IQuestion } from '../models/Question'; // To get correct answers for scoring
import { User, IUser } from '../models/User'; // To validate user
import { Quiz, IQuiz } from '../models/Quiz'; // To validate quiz and get quiz questions/scores
import { Training, ITraining } from '../models/Training';
// Importe tous les enums nécessaires depuis utils/types.ts
import { ApiError, AvailableLanguage, QuestionType, UserRole, NotificationType, QuizType } from '../utils/types';
import { createNotificationService } from './notificationService';
import { Types } from 'mongoose';

// Interfaces for QuizSession Data
interface StartQuizSessionData {
  user: string;
  quizId: string; // Now directly referencing the Quiz model
  language: AvailableLanguage; // Utilise l'enum AvailableLanguage
}

interface SubmitQuizSessionData {
  responses: Array<{
    question: string; // Question ID
    userAnswer: string | string[] | number; // User's answer
    timeTakenSeconds?: number;
  }>;
  durationSeconds: number; // Total duration of the quiz session
}


/**
 * Starts a new quiz session for a specific Quiz.
 * Fetches quiz details, validates attempts, and initializes the session.
 * Now includes details of each question (excluding sensitive info) in the response.
 * @param data Session creation data.
 * @returns The created quiz session document with populated question details.
 * @throws ApiError if user, quiz are invalid, or attempts exceeded.
 */
export const startQuizSessionService = async (data: StartQuizSessionData): Promise<IQuizSession> => {
  const { user: userId, quizId, language } = data;

  // 1. Validate user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError('User not found.', 404);
  }

  // 2. Validate Quiz and populate its questions to get their full details
  const quiz = await Quiz.findById(quizId).populate('questions.questionId').lean();
  if (!quiz) {
    throw new ApiError('Quiz not found.', 404);
  }

  // Check if quiz is published if user is a student and it's not their own revision quiz
  const isCreator = quiz.creator.toString() === userId;
  // Utilisation des valeurs de l'enum UserRole et QuizType
  if (user.role === UserRole.STUDENT && !quiz.isPublished && !(isCreator && quiz.quizType === QuizType.REVISION)) {
    throw new ApiError('Quiz is not published or not accessible to you.', 403);
  }

  // 3. Check allowed attempts
  if (quiz.allowedAttempts !== null && quiz.allowedAttempts !== undefined) {
    const existingSessions = await QuizSession.countDocuments({ user: new Types.ObjectId(userId), quiz: new Types.ObjectId(quizId) });
    if (existingSessions >= quiz.allowedAttempts) {
      throw new ApiError(`You have exceeded the maximum number of allowed attempts (${quiz.allowedAttempts}) for this quiz.`, 403);
    }
  }

  // 4. Calculate max possible score for this session (sum of question scores defined in the Quiz)
  let maxPossibleScore = 0;
  const initialResponses: IQuestionResponse[] = [];

  for (const qItem of quiz.questions) {
    const questionDoc = qItem.questionId as IQuestion; // Cast to IQuestion after population
    if (!questionDoc || !questionDoc._id) {
      console.warn(`Question document missing or invalid for a question in quiz ${quizId}`);
      continue;
    }

    maxPossibleScore += qItem.score;

    // IMPORTANT: Filter out sensitive information like 'isCorrect' and 'correctAnswerFormula'
    // Utilisation de la valeur de l'enum QuestionType
    const clientChoices = questionDoc.type === QuestionType.QCM && questionDoc.choices
      ? questionDoc.choices.map(choice => ({ text: choice.text })) // Only send 'text', not 'isCorrect'
      : undefined;

    const clientQuestion: IClientQuestion = {
      _id: questionDoc._id,
      text: questionDoc.text,
      type: questionDoc.type, // Utilise la valeur de l'enum QuestionType
      choices: clientChoices,
      difficulty: questionDoc.difficulty,
      tags: questionDoc.tags,
      // Do NOT include explanation or correctAnswerFormula here
    };

    initialResponses.push({
      question: clientQuestion, // Embed the safe client-facing question object
      userAnswer: '',
      isCorrect: false, // This is for internal tracking, not exposed to client in the populated field
      scoreEarned: 0,
      timeTakenSeconds: 0,
    });
  }

  if (maxPossibleScore === 0) {
    throw new ApiError('Quiz has no valid questions or question scores defined.', 400);
  }

  const newSession = new QuizSession({
    user: new Types.ObjectId(userId),
    quiz: new Types.ObjectId(quizId),
    quizDate: new Date(),
    totalScoreEarned: 0,
    maxPossibleScore: maxPossibleScore,
    quizGlobalScore: quiz.globalScore, // Copy global score from quiz
    finalCalculatedScore: 0, // Will be calculated on submit
    durationSeconds: 0, // Will be updated on completion
    responses: initialResponses, // This now contains full question objects (but safe ones)
    language, // Utilise l'enum AvailableLanguage
    isCompleted: false,
    passStatus: undefined,
    attemptNumber: (await QuizSession.countDocuments({ user: new Types.ObjectId(userId), quiz: new Types.ObjectId(quizId) })) + 1,
  });

  try {
    const savedSession = await newSession.save();
    // When returning, populate the 'question' field within 'responses' again,
    // but with specific fields selected to ensure no sensitive data leaks.
    const populatedSession = await QuizSession.findById(savedSession._id)
      .populate({
        path: 'responses.question',
        select: 'text type choices.text difficulty tags' // Explicitly select fields, and ONLY 'choices.text'
        // 'choices.isCorrect' and 'correctAnswerFormula' are NOT selected here.
      })
      .lean();
    return populatedSession as IQuizSession; // Return the populated version
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to start quiz session: ${error.message || 'Unknown error'}`, 500);
  }
};


/**
 * Submits and completes a quiz session, calculating scores based on the associated Quiz.
 * @param sessionId The ID of the quiz session.
 * @param data Submitted responses and total duration.
 * @param requestingUserId The ID of the user submitting (must match session.user).
 * @returns The completed quiz session document.
 * @throws ApiError if session not found, already completed, or not authorized.
 */
export const submitQuizSessionService = async (
  sessionId: string,
  data: SubmitQuizSessionData,
  requestingUserId: string
): Promise<IQuizSession> => {
  const { responses: submittedResponses, durationSeconds } = data;

  // IMPORTANT: Populate the quiz and its questions to get the CORRECT ANSWERS for scoring.
  const session = await QuizSession.findById(sessionId).populate({
    path: 'quiz',
    populate: {
      path: 'questions.questionId', // Populate the actual question documents within the quiz's questions array
      model: 'Question',
      select: 'text type choices.text choices.isCorrect correctAnswerFormula difficulty' // Select sensitive fields for scoring
    }
  }).populate('user', 'username').lean(); // Populer l'utilisateur pour la notification de l'enseignant

  if (!session) {
    throw new ApiError('Quiz session not found.', 404);
  }
  if (session.user.toString() !== requestingUserId) {
    throw new ApiError('Not authorized to submit this quiz session.', 403);
  }
  if (session.isCompleted) {
    throw new ApiError('Quiz session already completed.', 400);
  }
  if (typeof durationSeconds !== 'number' || durationSeconds < 0) {
    throw new ApiError('Invalid duration provided.', 400);
  }
  if (!session.quiz) {
    throw new ApiError('Associated quiz not found for this session.', 500);
  }

  let totalScoreEarned = 0;
  const updatedResponses: IQuestionResponse[] = [];

  // Create a map for quick lookup of question details from the associated quiz
  const quizQuestionsMap = new Map<string, { question: IQuestion, score: number }>();
  session.quiz.questions.forEach((qItem: any) => {
    if (qItem.questionId && qItem.questionId._id) {
      quizQuestionsMap.set(qItem.questionId._id.toString(), {
        question: qItem.questionId,
        score: qItem.score
      });
    }
  });


  for (const submittedResponse of submittedResponses) {
    const questionData = quizQuestionsMap.get(submittedResponse.question);

    if (!questionData) {
      throw new ApiError(`Question with ID ${submittedResponse.question} is not part of this quiz or is invalid.`, 400);
    }

    const { question, score } = questionData;

    let isCorrect = false;
    let scoreEarnedForThisQuestion = 0;

    // Utilisation de la valeur de l'enum QuestionType
    if (question.type === QuestionType.QCM && question.choices) {
      const correctChoiceTexts = question.choices
        .filter(c => c.isCorrect)
        .map(c => (c.text as any)[session.language] || c.text[AvailableLanguage.EN]); // Utilise AvailableLanguage

      const userAnswers = Array.isArray(submittedResponse.userAnswer)
        ? submittedResponse.userAnswer.map(ans => ans.toString())
        : [submittedResponse.userAnswer.toString()];

      isCorrect = correctChoiceTexts.length === userAnswers.length &&
        userAnswers.every(ua => correctChoiceTexts.includes(ua));

    } else if (question.type === QuestionType.CALCUL && question.correctAnswerFormula) { // Utilise la valeur de l'enum QuestionType
      isCorrect = (submittedResponse.userAnswer as any).toString() === question.correctAnswerFormula.toString();
    }

    if (isCorrect) {
      scoreEarnedForThisQuestion = score;
      totalScoreEarned += scoreEarnedForThisQuestion;
    }

    // Store only the ObjectId reference back in the DB for the question field within responses
    updatedResponses.push({
      question: new Types.ObjectId(submittedResponse.question),
      userAnswer: submittedResponse.userAnswer,
      isCorrect,
      scoreEarned: scoreEarnedForThisQuestion,
      timeTakenSeconds: submittedResponse.timeTakenSeconds || 0,
    });
  }

  // Calculate final weighted score
  const finalCalculatedScore = session.maxPossibleScore > 0
    ? (totalScoreEarned / session.maxPossibleScore) * session.quizGlobalScore
    : 0;

  // Determine pass/fail status
  const passThreshold = 0.7; // 70% of the quiz's global score
  const passStatus = (finalCalculatedScore / session.quizGlobalScore) >= passThreshold ? 'passed' : 'failed';

  // Set the session's final properties
  const updatedSession = await QuizSession.findByIdAndUpdate(
    sessionId,
    {
      responses: updatedResponses,
      totalScoreEarned: totalScoreEarned,
      finalCalculatedScore: finalCalculatedScore,
      durationSeconds: durationSeconds,
      isCompleted: true,
      passStatus: passStatus,
    },
    { new: true, runValidators: true }
  ).populate('user', 'username email profile.firstName profile.lastName')
   .populate({
      path: 'quiz',
      select: 'title quizType training creator isPublished globalScore',
      populate: {
        path: 'training',
        select: 'title slug teachers' // Populez les enseignants de la formation
      }
    })
   .populate({
      path: 'responses.question',
      select: 'text type choices.text difficulty tags'
    })
   .lean();

  if (!updatedSession) {
    throw new ApiError('Quiz session not found or could not be updated after submission.', 500);
  }

  // --- NOTIFICATION POUR TEACHER : Nouveaux résultats de quiz ---
  // Déterminer le destinataire de la notification (créateur du quiz et enseignants de la formation)
  const quizCreatorId = (updatedSession.quiz as any).creator.toString();
  const trainingTeachers = ((updatedSession.quiz as any).training as ITraining)?.teachers?.map(id => id.toString()) || [];
  const studentUsername = (updatedSession.user as IUser).username;
  const quizTitle = (updatedSession.quiz as any).title[AvailableLanguage.FR]; // Utilise AvailableLanguage

  const recipients = new Set<string>();
  recipients.add(quizCreatorId); // Le créateur du quiz est toujours notifié
  trainingTeachers.forEach(id => recipients.add(id)); // Les enseignants de la formation sont aussi notifiés

  for (const recipientId of recipients) {
    await createNotificationService({
      recipientId: recipientId,
      type: NotificationType.QUIZ_GRADED, // Utilise l'enum NotificationType
      message: `De nouveaux résultats sont disponibles pour le quiz "${quizTitle}". L'étudiant ${studentUsername} a terminé sa session.`,
      relatedEntityId: updatedSession._id.toString(),
      relatedEntityType: 'QuizSession',
    });
  }
  // --- FIN NOTIFICATION ---

  return updatedSession as IQuizSession;
};

/**
 * Retrieves all quiz sessions, with filtering and pagination.
 * Access control applied based on user role.
 * @param filters Optional filtering criteria (e.g., user, quiz, isCompleted).
 * @param options Pagination and population options.
 * @param requestingUser The authenticated user making the request.
 * @returns An array of quiz session documents.
 */
export const getAllQuizSessionsService = async (
  filters: any = {},
  options: { page?: number; limit?: number; populateUser?: boolean; populateQuiz?: boolean; populateQuestions?: boolean } = {},
  requestingUser: { id: string; role: UserRole }
): Promise<IQuizSession[]> => {
  const { page = 1, limit = 10, populateUser = false, populateQuiz = false, populateQuestions = false } = options;
  const skip = (page - 1) * limit;

  let queryFilters: any = { ...filters };

  // Enforce authorization rules
  // Utilisation des valeurs de l'enum UserRole et QuizType
  if (requestingUser.role === UserRole.STUDENT) {
    queryFilters.user = new Types.ObjectId(requestingUser.id); // Students can only see their own sessions
  } else if (requestingUser.role === UserRole.TEACHER) {
    // Teachers can see sessions for quizzes they created or quizzes linked to trainings they teach.
    // This requires more complex aggregation or multiple queries. For simplicity, we'll extend filters.
    // Fetch quizzes created by the teacher
    const createdQuizzes = await Quiz.find({ creator: requestingUser.id }).select('_id');
    const createdQuizIds = createdQuizzes.map(q => q._id);

    // Fetch trainings where the teacher is assigned
    const assignedTrainings = await Training.find({ teachers: requestingUser.id }).select('_id');
    const assignedTrainingIds = assignedTrainings.map(t => t._id);

    // Find quizzes associated with those trainings
    const quizzesInAssignedTrainings = await Quiz.find({ training: { $in: assignedTrainingIds } }).select('_id');
    const quizzesFromAssignedTrainingsIds = quizzesInAssignedTrainings.map(q => q._id);

    // Combine all relevant quiz IDs
    const accessibleQuizIds = [...new Set([...createdQuizIds, ...quizzesFromAssignedTrainingsIds])];

    if (accessibleQuizIds.length > 0) {
      queryFilters.quiz = { $in: accessibleQuizIds };
    } else {
      // If teacher is not associated with any quizzes or trainings, they see nothing
      queryFilters.quiz = null; // Forces no results
    }

    // If a specific user filter is applied, ensure the teacher can access that user's sessions
    if (filters.user && typeof filters.user === 'string') {
        const targetUserId = new Types.ObjectId(filters.user);
        const userExists = await User.findById(targetUserId);
        if(!userExists) throw new ApiError('Target user not found.', 404);

        // For a teacher to see another user's session, that session must be tied to a quiz the teacher can access
        // This means the existing 'queryFilters.quiz' must still contain the quiz relevant to the target user's session
        // No explicit check for user's enrollment to training is required here.
        queryFilters.user = targetUserId;
    }
  }


  let query = QuizSession.find(queryFilters).sort({ quizDate: -1 });

  if (populateUser) query = query.populate('user', 'username email profile.firstName profile.lastName');
  // Populate quiz and potentially its related training if needed
  if (populateQuiz) query = query.populate({
    path: 'quiz',
    select: 'title quizType training creator isPublished globalScore', // Select relevant fields from Quiz
    populate: {
      path: 'training', // Populate training within the quiz
      select: 'title slug'
    }
  });
  if (populateQuestions) query = query.populate('responses.question', 'text type difficulty'); // Populate question details within responses

  const sessions = await query.skip(skip).limit(limit).lean();
  return sessions;
};

/**
 * Retrieves a single quiz session by ID.
 * Access control applied in service.
 * @param sessionId The ID of the quiz session.
 * @param options Population options.
 * @param requestingUser The authenticated user making the request.
 * @returns The quiz session document.
 * @throws ApiError if session not found or not authorized.
 */
export const getQuizSessionByIdService = async (
  sessionId: string,
  options: { populateUser?: boolean; populateQuiz?: boolean; populateQuestions?: boolean } = {},
  requestingUser: { id: string; role: UserRole }
): Promise<IQuizSession> => {
  if (!Types.ObjectId.isValid(sessionId)) {
    throw new ApiError('Invalid quiz session ID format.', 400);
  }

  let query = QuizSession.findById(sessionId);

  if (populateUser) query = query.populate('user', 'username email profile.firstName profile.lastName');
  if (populateQuiz) query = query.populate({
    path: 'quiz',
    select: 'title quizType training creator isPublished globalScore', // Select relevant fields from Quiz
    populate: {
      path: 'training', // Populate training within the quiz
      select: 'title slug'
    }
  });
  if (populateQuestions) query = query.populate('responses.question', 'text type difficulty');

  const session = await query.lean();

  if (!session) {
    throw new ApiError('Quiz session not found.', 404);
  }

  // Authorization: Student can only view their own
  // Utilisation de la valeur de l'enum UserRole
  if (requestingUser.role === UserRole.STUDENT && session.user.toString() !== requestingUser.id) {
    throw new ApiError('Not authorized to view this quiz session.', 403);
  }

  // Teacher authorization
  // Utilisation de la valeur de l'enum UserRole
  if (requestingUser.role === UserRole.TEACHER) {
    // Teachers can view sessions for quizzes they created or quizzes linked to trainings they teach.
    if (!session.quiz) { // Should not happen if populateQuiz is true and the quiz reference is valid
      throw new ApiError('Associated quiz not found for this session.', 500);
    }

    const quizId = (session.quiz as IQuiz)._id; // Cast to IQuiz to access _id
    const isCreatorQuiz = await Quiz.exists({ _id: quizId, creator: requestingUser.id });
    const isTrainingTeacher = await Quiz.exists({ _id: quizId, training: { $in: (await Training.find({ teachers: requestingUser.id }).select('_id')).map(t => t._id) } });

    if (!isCreatorQuiz && !isTrainingTeacher) {
      throw new ApiError('Not authorized to view this quiz session.', 403);
    }
  }

  return session;
};


/**
 * Deletes a quiz session.
 * Only Managers/Admins can delete sessions. Students can delete their own incomplete revision quiz sessions.
 * @param sessionId The ID of the quiz session to delete.
 * @param requestingUser The user performing the deletion.
 * @returns Success message.
 * @throws ApiError if session not found or not authorized.
 */
export const deleteQuizSessionService = async (
  sessionId: string,
  requestingUser: { id: string; role: UserRole }
): Promise<{ message: string }> => {
  if (!Types.ObjectId.isValid(sessionId)) {
    throw new ApiError('Invalid quiz session ID format.', 400);
  }

  const session = await QuizSession.findById(sessionId);
  if (!session) {
    throw new ApiError('Quiz session not found or could not be deleted.', 404);
  }

  // Utilisation de la valeur de l'enum UserRole
  const isAdminOrManager = [UserRole.ADMIN, UserRole.MANAGER].includes(requestingUser.role);
  const isStudentAndOwnIncompleteRevision = (
    requestingUser.role === UserRole.STUDENT && // Utilise la valeur de l'enum UserRole
    session.user.toString() === requestingUser.id &&
    !session.isCompleted // Students can only delete incomplete sessions
    // Optionally check if it's a revision quiz, but any incomplete session might be deletable by student
  );

  if (!isAdminOrManager && !isStudentAndOwnIncompleteRevision) {
    throw new ApiError('Not authorized to delete this quiz session.', 403);
  }

  try {
    await QuizSession.deleteOne({ _id: sessionId });
    return { message: 'Quiz session deleted successfully.' };
  } catch (error: any) {
    throw new ApiError(`Failed to delete quiz session: ${error.message || 'Unknown error'}`, 500);
  }
};
