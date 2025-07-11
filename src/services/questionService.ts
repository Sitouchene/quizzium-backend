// src/services/questionService.ts
import { Question, IQuestion, IChoice } from '../models/Question'; // Removed local MediaType import
import { Chapter } from '../models/Chapter'; 
// Importe les enums et interfaces nécessaires depuis utils/types.ts
// NOUVEAU: Importer MediaType d'ici
import { ApiError, ILocalizedString, QuestionType, UserRole, MediaType } from '../utils/types'; 
import { Types } from 'mongoose';

// Interfaces for Question Data
interface CreateQuestionData {
  chapter: string; 
  text: ILocalizedString;
  mediaType?: MediaType; // Nouveau champ
  mediaUrl?: string; // Nouveau champ
  mediaAltText?: string; // Nouveau champ
  type: QuestionType; 
  choices?: IChoice[]; // Pour QCM
  correctAnswerFormula?: string; // Pour Calcul
  explanation?: ILocalizedString;
  difficulty: 'easy' | 'medium' | 'hard'; 
  tags?: string[];
}

interface UpdateQuestionData {
  text?: ILocalizedString;
  mediaType?: MediaType; // Nouveau champ
  mediaUrl?: string; // Nouveau champ
  mediaAltText?: string; // Nouveau champ
  type?: QuestionType; 
  choices?: IChoice[];
  correctAnswerFormula?: string;
  explanation?: ILocalizedString;
  difficulty?: 'easy' | 'medium' | 'hard'; 
  tags?: string[];
}

/**
 * Creates a new question for a specific chapter.
 * @param data Question data.
 * @returns The created question document.
 * @throws ApiError if creation fails (e.g., chapter not found, validation errors).
 */
export const createQuestionService = async (data: CreateQuestionData): Promise<IQuestion> => {
  const { chapter, text, mediaType, mediaUrl, mediaAltText, type, choices, correctAnswerFormula, explanation, difficulty, tags } = data;

  // Validate if the parent chapter exists
  const parentChapter = await Chapter.findById(chapter);
  if (!parentChapter) {
    throw new ApiError('Parent chapter not found.', 404);
  }

  // Basic validation for media fields if provided
  if (mediaUrl && !mediaType) {
    throw new ApiError('mediaType is required if mediaUrl is provided.', 400);
  }
  if (mediaType && !mediaUrl) {
    throw new ApiError('mediaUrl is required if mediaType is provided.', 400);
  }
  if (mediaType === MediaType.IMAGE && !mediaAltText) {
    throw new ApiError('mediaAltText is required for image media types.', 400);
  }

  // Validate choices media if present
  if (choices && choices.length > 0) {
    for (const choice of choices) {
      if (choice.choiceMediaUrl && !choice.choiceMediaType) {
        throw new ApiError(`choiceMediaType is required if choiceMediaUrl is provided for choice: ${choice.text.fr || choice.text.en || ''}.`, 400);
      }
      if (choice.choiceMediaType && !choice.choiceMediaUrl) {
        throw new ApiError(`choiceMediaUrl is required if choiceMediaType is provided for choice: ${choice.text.fr || choice.text.en || ''}.`, 400);
      }
      if (choice.choiceMediaType === MediaType.IMAGE && !choice.choiceMediaAltText) {
        throw new ApiError(`choiceMediaAltText is required for image choice media types for choice: ${choice.text.fr || choice.text.en || ''}.`, 400);
      }
    }
  }

  const newQuestion = new Question({
    chapter: new Types.ObjectId(chapter),
    text,
    mediaType,
    mediaUrl,
    mediaAltText,
    type,
    choices,
    correctAnswerFormula,
    explanation,
    difficulty,
    tags,
  });

  try {
    await newQuestion.save();
    parentChapter.questions.push(newQuestion._id);
    await parentChapter.save();

    return newQuestion;
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to create question: ${error.message || 'Unknown error'}`, 500);
  }
};


/**
 * Creates multiple new questions.
 * @param questionsData An array of question data objects.
 * @returns An array of IDs of the newly created question documents.
 * @throws ApiError if creation fails (e.g., chapter not found for any question, validation errors).
 */
export const createMultipleQuestionsService = async (
  questionsData: CreateQuestionData[]
): Promise<string[]> => {
  if (!questionsData || questionsData.length === 0) {
    throw new ApiError('No questions provided for creation.', 400);
  }

  const createdQuestionIds: string[] = [];

  for (const questionData of questionsData) {
    try {
      const newQuestion = await createQuestionService(questionData);
      createdQuestionIds.push(newQuestion._id.toString());
    } catch (error: any) {
      throw new ApiError(`Failed to create one or more questions: ${error.message || 'Unknown error'}`, 400);
    (error instanceof ApiError) ? error : new ApiError(`Failed to create one or more questions: ${error.message || 'Unknown error'}`, 400);
    }
  }

  return createdQuestionIds;
};

/**
 * Retrieves all questions, optionally filtered by chapter ID.
 * @param chapterId Optional ID to filter questions by parent chapter.
 * @param options Pagination options.
 * @returns An array of question documents.
 */
export const getAllQuestionsService = async (
  chapterId?: string,
  options: { page?: number; limit?: number; includeAnswers?: boolean } = {}
): Promise<IQuestion[]> => {
  const { page = 1, limit = 10, includeAnswers = false } = options;
  const skip = (page - 1) * limit;

  const filters: any = {};
  if (chapterId) {
    if (!Types.ObjectId.isValid(chapterId)) {
      throw new ApiError('Invalid chapter ID format.', 400);
    }
    filters.chapter = new Types.ObjectId(chapterId);
  }

  let query = Question.find(filters);

  // Inclure ou exclure les champs de média selon les besoins futurs.
  // Pour l'instant, ils sont toujours inclus dans la sélection de base du modèle.
  // Si includeAnswers est false (pour étudiants prenant quiz), exclure les champs sensibles
  if (!includeAnswers) {
    query = query.select('-choices.isCorrect -correctAnswerFormula -explanation');
  }

  const questions = await query.skip(skip).limit(limit).lean();
  return questions;
};

/**
 * Retrieves a single question by ID.
 * @param questionId The ID of the question.
 * @param options Population and answer inclusion options.
 * @returns The question document.
 * @throws ApiError if question not found.
 */
export const getQuestionByIdService = async (
  questionId: string,
  options: { includeAnswers?: boolean } = {}
): Promise<IQuestion> => {
  const { includeAnswers = false } = options;

  let query = Question.findById(questionId);

  // Si includeAnswers est false, exclure les champs sensibles
  if (!includeAnswers) {
    query = query.select('-choices.isCorrect -correctAnswerFormula -explanation');
  }

  const question = await query.lean();
  if (!question) {
    throw new ApiError('Question not found.', 404);
  }
  return question;
};

/**
 * Updates an existing question.
 * @param questionId The ID of the question to update.
 * @param updateData Data to update.
 * @returns The updated question document.
 * @throws ApiError if question not found or update fails due to validation.
 */
export const updateQuestionService = async (
  questionId: string,
  updateData: UpdateQuestionData
): Promise<IQuestion> => {
  try {
    // Basic validation for media fields if provided in updateData
    if (updateData.mediaUrl && !updateData.mediaType) {
      throw new ApiError('mediaType is required if mediaUrl is provided in update.', 400);
    }
    if (updateData.mediaType && !updateData.mediaUrl) {
      throw new ApiError('mediaUrl is required if mediaType is provided in update.', 400);
    }
    if (updateData.mediaType === MediaType.IMAGE && updateData.mediaAltText === undefined) { // Check for explicit undefined to allow null/empty string to remove
      throw new ApiError('mediaAltText is required for image media types.', 400);
    }
    // Handle clearing media fields if mediaUrl is explicitly set to null/undefined
    if (updateData.mediaUrl === null) {
      updateData.mediaType = undefined;
      updateData.mediaAltText = undefined;
    }

    // Validate choices media if present
    if (updateData.choices && updateData.choices.length > 0) {
      for (const choice of updateData.choices) {
        if (choice.choiceMediaUrl && !choice.choiceMediaType) {
          throw new ApiError(`choiceMediaType is required if choiceMediaUrl is provided for choice: ${choice.text.fr || choice.text.en || ''}.`, 400);
        }
        if (choice.choiceMediaType && !choice.choiceMediaUrl) {
          throw new ApiError(`choiceMediaUrl is required if choiceMediaType is provided for choice: ${choice.text.fr || choice.text.en || ''}.`, 400);
        }
        if (choice.choiceMediaType === MediaType.IMAGE && choice.choiceMediaAltText === undefined) {
          throw new ApiError(`choiceMediaAltText is required for image choice media types for choice: ${choice.text.fr || choice.text.en || ''}.`, 400);
        }
        if (choice.choiceMediaUrl === null) { // Handle clearing choice media fields
          choice.choiceMediaType = undefined;
          choice.choiceMediaAltText = undefined;
        }
      }
    }


    const updatedQuestion = await Question.findByIdAndUpdate(
      questionId,
      { $set: updateData }, // $set pour mettre à jour les champs fournis
      { new: true, runValidators: true }
    ).lean();

    if (!updatedQuestion) {
      throw new ApiError('Question not found or could not be updated.', 404);
    }
    return updatedQuestion;
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to update question: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Deletes a question.
 * @param questionId The ID of the question to delete.
 * @returns Success message.
 * @throws ApiError if question not found.
 */
export const deleteQuestionService = async (questionId: string): Promise<{ message: string }> => {
  const questionToDelete = await Question.findById(questionId);
  if (!questionToDelete) {
    throw new ApiError('Question not found or could not be deleted.', 404);
  }

  // Remove question ID from its parent chapter's questions array
  await Chapter.findByIdAndUpdate(
    questionToDelete.chapter,
    { $pull: { questions: questionToDelete._id } }
  );

  // TODO: Potentially update QuizSessions that referenced this question (e.g., remove from responses or mark as invalid)
  await Question.deleteOne({ _id: questionId });

  return { message: 'Question deleted successfully.' };
};
