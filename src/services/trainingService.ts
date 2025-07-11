// src/services/trainingService.ts
import { Training, ITraining } from '../models/Training';
import { Chapter, IChapter } from '../models/Chapter'; // Assurez-vous d'avoir ce modèle
import { Question, IQuestion } from '../models/Question'; // Assurez-vous d'avoir ce modèle
import { User } from '../models/User'; // To validate creator and teacher IDs
// Importe les enums nécessaires depuis utils/types.ts
import { ApiError, ILocalizedString,TrainingCategory, UserRole } from '../utils/types';
import { Types } from 'mongoose'; // For ObjectId validation

// --- Interfaces for Request/Response Data ---

interface CreateTrainingData {
  title: ILocalizedString;
  description: ILocalizedString;
  slug: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced'; // Type littéral string inchangé
  createdBy: string; // User ID of the creator (manager/admin)
  isPublished?: boolean;
  durationHours?: number;
  thumbnailUrl?: string;
  tags?: string[];
}

interface UpdateTrainingData {
  title?: ILocalizedString;
  description?: ILocalizedString;
  slug?: string;
  category?: string;
  level?: 'beginner' | 'intermediate' | 'advanced'; // Type littéral string inchangé
  isPublished?: boolean;
  durationHours?: number;
  thumbnailUrl?: string;
  tags?: string[];
}

// --- Service Functions ---

/**
 * Creates a new training.
 * Only 'manager' or 'admin' roles can create trainings.
 * @param data Training data including `createdBy` (ID of the manager/admin).
 * @returns The created training document.
 * @throws ApiError if creation fails (e.g., duplicate slug, invalid creator role).
 */
export const createTrainingService = async (data: CreateTrainingData): Promise<ITraining> => {
  const { createdBy, ...trainingData } = data;

  // Validate createdBy: Ensure the user exists and has a 'manager' or 'admin' role.
  const creatorUser = await User.findById(createdBy).select('role');
  // Utilisation des valeurs de l'enum UserRole
  if (!creatorUser || ![UserRole.MANAGER, UserRole.ADMIN].includes(creatorUser.role)) {
    throw new ApiError('Creator must be a valid manager or admin user.', 403); // Forbidden
  }

  const newTraining = new Training({
    ...trainingData,
    createdBy: new Types.ObjectId(createdBy), // Convert string ID to ObjectId
  });

  try {
    await newTraining.save();
    return newTraining;
  } catch (error: any) {
    if (error.code === 11000) { // Duplicate key error (e.g., duplicate slug)
      throw new ApiError('Training with this slug already exists.', 409); // Conflict
    }
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400); // Bad Request
    }
    throw new ApiError(`Failed to create training: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Adds an array of chapter IDs to a specific training.
 * Only accessible by managers or teachers.
 * @param trainingId The ID of the training to update.
 * @param chapterIds An array of chapter IDs to add.
 * @param requestingUser The authenticated user performing the action.
 * @returns The updated training document.
 * @throws ApiError if training not found, chapter IDs are invalid, or not authorized.
 */
export const addChaptersToTrainingService = async (
  trainingId: string,
  chapterIds: string[],
  requestingUser: { id: string; role: UserRole }
): Promise<ITraining> => {
  if (!Types.ObjectId.isValid(trainingId)) {
    throw new ApiError('Invalid training ID format.', 400);
  }
  if (!chapterIds || !Array.isArray(chapterIds) || chapterIds.length === 0) {
    throw new ApiError('An array of chapter IDs is required.', 400);
  }

  // Authorization check - Utilisation des valeurs de l'enum UserRole
  const isAdminOrManager = [UserRole.ADMIN, UserRole.MANAGER].includes(requestingUser.role);
  const isTeacher = requestingUser.role === UserRole.TEACHER;

  if (!isAdminOrManager && !isTeacher) {
    throw new ApiError('Not authorized to add chapters to this training.', 403);
  }

  const training = await Training.findById(trainingId);
  if (!training) {
    throw new ApiError('Training not found.', 404);
  }

  // If teacher, ensure they are assigned to this training
  if (isTeacher && !training.teachers.some(teacherId => teacherId.toString() === requestingUser.id)) {
    throw new ApiError('Teacher not assigned to this training.', 403);
  }

  // Convert string IDs to Mongoose ObjectIds and filter out duplicates
  const newChapterObjectIds = chapterIds
    .filter(id => Types.ObjectId.isValid(id))
    .map(id => new Types.ObjectId(id));

  if (newChapterObjectIds.length !== chapterIds.length) {
    throw new ApiError('One or more chapter IDs are invalid.', 400);
  }

  // Validate that all chapters actually exist and belong to the correct training (optional but recommended)
  const existingChapters = await Chapter.find({ _id: { $in: newChapterObjectIds } });
  if (existingChapters.length !== newChapterObjectIds.length) {
    throw new ApiError('One or more chapters not found.', 404);
  }
  // Check if chapters already exist in the training to prevent duplicates in the array
  const currentChapterIds = training.chapters.map(id => id.toString());
  const chaptersToAdd = newChapterObjectIds.filter(id => !currentChapterIds.includes(id.toString()));

  if (chaptersToAdd.length === 0) {
    return training; // No new chapters to add, return current training
  }

  training.chapters.push(...chaptersToAdd);

  try {
    await training.save();
    return training;
  } catch (error: any) {
    throw new ApiError(`Failed to add chapters to training: ${error.message || 'Unknown error'}`, 500);
  }
};


/**
 * Adds an array of question IDs to a specific training.
 * This assumes the Training model has a 'questions' array field.
 * Only accessible by managers or teachers.
 * @param trainingId The ID of the training to update.
 * @param questionIds An array of question IDs to add.
 * @param requestingUser The authenticated user performing the action.
 * @returns The updated training document.
 * @throws ApiError if training not found, question IDs are invalid, or not authorized.
 */
export const addQuestionsToTrainingService = async (
  trainingId: string,
  questionIds: string[],
  requestingUser: { id: string; role: UserRole }
): Promise<ITraining> => {
  if (!Types.ObjectId.isValid(trainingId)) {
    throw new ApiError('Invalid training ID format.', 400);
  }
  if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
    throw new ApiError('An array of question IDs is required.', 400);
  }

  // Authorization check (same as addChaptersToTrainingService) - Utilisation des valeurs de l'enum UserRole
  const isAdminOrManager = [UserRole.ADMIN, UserRole.MANAGER].includes(requestingUser.role);
  const isTeacher = requestingUser.role === UserRole.TEACHER;

  if (!isAdminOrManager && !isTeacher) {
    throw new ApiError('Not authorized to add questions to this training.', 403);
  }

  const training = await Training.findById(trainingId);
  if (!training) {
    throw new ApiError('Training not found.', 404);
  }

  // If teacher, ensure they are assigned to this training
  if (isTeacher && !training.teachers.some(teacherId => teacherId.toString() === requestingUser.id)) {
    throw new ApiError('Teacher not assigned to this training.', 403);
  }

  // Convert string IDs to Mongoose ObjectIds and filter out duplicates
  const newQuestionObjectIds = questionIds
    .filter(id => Types.ObjectId.isValid(id))
    .map(id => new Types.ObjectId(id));

  if (newQuestionObjectIds.length !== questionIds.length) {
    throw new ApiError('One or more question IDs are invalid.', 400);
  }

  // Validate that all questions actually exist
  const existingQuestions = await Question.find({ _id: { $in: newQuestionObjectIds } });
  if (existingQuestions.length !== newQuestionObjectIds.length) {
    throw new ApiError('One or more questions not found.', 404);
  }

  // Check if questions already exist in the training to prevent duplicates
  const currentQuestionIds = training.questions?.map(id => id.toString()) || []; // Utilisez `?.` et un tableau vide par défaut
  const questionsToAdd = newQuestionObjectIds.filter(id => !currentQuestionIds.includes(id.toString()));

  if (questionsToAdd.length === 0) {
    return training; // No new questions to add
  }

  training.questions?.push(...questionsToAdd); // Utilisez `?.` ici aussi

  try {
    await training.save();
    return training;
  } catch (error: any) {
    throw new ApiError(`Failed to add questions to training: ${error.message || 'Unknown error'}`, 500);
  }
};




/**
 * Retrieves all trainings.
 * @param filters Optional filtering criteria (e.g., category, level).
 * @param options Pagination and population options.
 * @returns An array of training documents.
 */
export const getAllTrainingsService = async (
  filters: any = {}, // e.g., { category: '...', level: '...' }
  options: { page?: number; limit?: number; populateCreatedBy?: boolean; populateTeachers?: boolean } = {}
): Promise<ITraining[]> => {
  const { page = 1, limit = 10, populateCreatedBy = false, populateTeachers = false } = options;
  const skip = (page - 1) * limit;

  let query = Training.find(filters);

  if (populateCreatedBy) {
    query = query.populate('createdBy', 'username email profile.firstName profile.lastName');
  }
  if (populateTeachers) {
    query = query.populate('teachers', 'username email profile.firstName profile.lastName');
  }

  const trainings = await query.skip(skip).limit(limit).lean();
  return trainings;
};

/**
 * Retrieves a single training by ID.
 * @param trainingId The ID of the training.
 * @param options Population options.
 * @returns The training document.
 * @throws ApiError if training not found.
 */
export const getTrainingByIdService = async (
  trainingId: string,
  options: { populateCreatedBy?: boolean; populateTeachers?: boolean } = {}
): Promise<ITraining> => {
  const { populateCreatedBy = false, populateTeachers = false } = options;

  let query = Training.findById(trainingId);

  if (populateCreatedBy) {
    query = query.populate('createdBy', 'username email profile.firstName profile.lastName');
  }
  if (populateTeachers) {
    query = query.populate('teachers', 'username email profile.firstName profile.lastName');
  }

  const training = await query.lean();
  if (!training) {
    throw new ApiError('Training not found.', 404);
  }
  return training;
};

/**
 * Updates an existing training.
 * Only 'manager' or 'admin' can update trainings.
 * @param trainingId The ID of the training to update.
 * @param updateData Data to update.
 * @returns The updated training document.
 * @throws ApiError if training not found or update fails due to validation.
 */
export const updateTrainingService = async (
  trainingId: string,
  updateData: UpdateTrainingData
): Promise<ITraining> => {
  try {
    const updatedTraining = await Training.findByIdAndUpdate(
      trainingId,
      { $set: updateData }, // Use $set to update specific fields
      { new: true, runValidators: true } // Return updated doc, run schema validators
    ).lean();

    if (!updatedTraining) {
      throw new ApiError('Training not found or could not be updated.', 404);
    }
    return updatedTraining;
  } catch (error: any) {
    if (error.code === 11000) {
      throw new ApiError('Training with this slug already exists.', 409);
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to update training: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Deletes a training.
 * Only 'manager' or 'admin' can delete trainings.
 * @param trainingId The ID of the training to delete.
 * @returns Success message.
 * @throws ApiError if training not found.
 */
export const deleteTrainingService = async (trainingId: string): Promise<{ message: string }> => {
  const result = await Training.findByIdAndDelete(trainingId);
  if (!result) {
    throw new ApiError('Training not found or could not be deleted.', 404);
  }
  // TODO: Implement cascading deletion for associated chapters, questions, enrollments etc.
  return { message: 'Training deleted successfully.' };
};


/**
 * Assigne un ou plusieurs enseignants à une formation.
 * Cette fonction REMPLACE le tableau existant d'enseignants avec la liste fournie.
 * Valide que les IDs des enseignants sont valides et correspondent à des utilisateurs de type 'teacher'.
 * @param trainingId L'ID de la formation à mettre à jour.
 * @param newTeacherIds Un tableau d'IDs d'utilisateurs à assigner comme enseignants (cette liste remplacera l'ancienne).
 * @returns Le document Training mis à jour.
 * @throws ApiError si la formation n'est pas trouvée, ou si des IDs d'enseignants sont invalides.
 */
export const assignTeachersToTrainingService = async (
  trainingId: string,
  newTeacherIds: string[] // Renommé pour plus de clarté
): Promise<ITraining> => {
  if (!Types.ObjectId.isValid(trainingId)) {
    throw new ApiError('Invalid training ID format.', 400);
  }

  const training = await Training.findById(trainingId);
  if (!training) {
    throw new ApiError('Training not found.', 404);
  }

  const validTeacherObjectIds: Types.ObjectId[] = [];
  const invalidTeacherIds: string[] = [];

  // Valider chaque ID d'enseignant fourni
  if (newTeacherIds && newTeacherIds.length > 0) {
    // Filtrer les IDs uniques pour éviter les doublons accidentels dans la nouvelle liste
    const uniqueTeacherIds = [...new Set(newTeacherIds)];

    // Récupérer les utilisateurs correspondants et vérifier leur rôle en une seule requête
    const foundTeachers = await User.find({ _id: { $in: uniqueTeacherIds } }).select('_id role');
    const foundTeacherMap = new Map(foundTeachers.map(t => [t._id.toString(), t.role]));

    for (const id of uniqueTeacherIds) {
      if (!Types.ObjectId.isValid(id)) {
        invalidTeacherIds.push(id);
        continue;
      }
      const role = foundTeacherMap.get(id);
      if (role && role === UserRole.TEACHER) { // Utilisation de l'enum UserRole
        validTeacherObjectIds.push(new Types.ObjectId(id));
      } else {
        invalidTeacherIds.push(id); // ID non trouvé ou rôle non 'teacher'
      }
    }
  }

  if (invalidTeacherIds.length > 0) {
    throw new ApiError(`Invalid or non-teacher user IDs provided: ${invalidTeacherIds.join(', ')}.`, 400);
  }

  try {
    // REMPLACE le tableau 'teachers' existant avec la nouvelle liste validée.
    // Cela permet à la fois d'ajouter de nouveaux enseignants et de supprimer ceux qui ne sont plus dans la liste.
    training.teachers = validTeacherObjectIds;
    await training.save();

    return training;
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to update teachers for training: ${error.message || 'Unknown error'}`, 500);
  }
};

