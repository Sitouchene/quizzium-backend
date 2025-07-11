// src/services/chapterService.ts
import { Chapter, IChapter } from '../models/Chapter';
import { Training } from '../models/Training'; // To validate training existence
// Importe les enums et interfaces nécessaires depuis utils/types.ts
import { ApiError, ILocalizedString, QuestionType } from '../utils/types'; 
import { Types } from 'mongoose';

// Interfaces for Chapter Data
interface CreateChapterData {
  title: ILocalizedString;
  description?: ILocalizedString;
  thumbnailUrl?: string;
  training: string; // ID of the parent training
  order: number;
}

interface UpdateChapterData {
  title?: ILocalizedString;
  description?: ILocalizedString;
  thumbnailUrl?: string;
  order?: number;
}

/**
 * Creates a new chapter for a specific training.
 * @param data Chapter data.
 * @returns The created chapter document.
 * @throws ApiError if creation fails (e.g., training not found, duplicate order).
 */
export const createChapterService = async (data: CreateChapterData): Promise<IChapter> => {
  const { training, order, ...rest } = data;

  // Validate if the parent training exists
  const parentTraining = await Training.findById(training);
  if (!parentTraining) {
    throw new ApiError('Parent training not found.', 404);
  }

  const newChapter = new Chapter({
    ...rest,
    training: new Types.ObjectId(training),
    order: order,
  });

  try {
    await newChapter.save();
    // Optionally: Add chapter ID to the parent training's chapters array
    // Assurez-vous que 'chapters' est initialisé si nécessaire dans le modèle Training
    parentTraining.chapters.push(newChapter._id);
    await parentTraining.save();

    return newChapter;
  } catch (error: any) {
    if (error.code === 11000) { // Duplicate key error (e.g., training and order unique index)
      throw new ApiError('Chapter with this order already exists in this training.', 409);
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to create chapter: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Retrieves all chapters, optionally filtered by training ID.
 * @param trainingId Optional ID to filter chapters by parent training.
 * @param options Pagination and population options.
 * @returns An array of chapter documents.
 */
export const getAllChaptersService = async (
  trainingId?: string,
  options: { page?: number; limit?: number; populateQuestions?: boolean } = {}
): Promise<IChapter[]> => {
  const { page = 1, limit = 10, populateQuestions = false } = options;
  const skip = (page - 1) * limit;

  const filters: any = {};
  if (trainingId) {
    if (!Types.ObjectId.isValid(trainingId)) {
      throw new ApiError('Invalid training ID format.', 400);
    }
    filters.training = new Types.ObjectId(trainingId);
  }

  let query = Chapter.find(filters).sort({ order: 1 }); // Sort by order

  if (populateQuestions) {
    // Les types 'text', 'type', 'difficulty' sont des champs dans le modèle Question
    // 'type' ici est utilisé pour le filtre de sélection, et non une valeur d'enum directe
    query = query.populate('questions', 'text type difficulty'); // Populate questions with selected fields
  }

  const chapters = await query.skip(skip).limit(limit).lean();
  return chapters;
};

/**
 * Retrieves a single chapter by ID.
 * @param chapterId The ID of the chapter.
 * @param options Population options.
 * @returns The chapter document.
 * @throws ApiError if chapter not found.
 */
export const getChapterByIdService = async (
  chapterId: string,
  options: { populateQuestions?: boolean } = {}
): Promise<IChapter> => {
  const { populateQuestions = false } = options;

  let query = Chapter.findById(chapterId);

  if (populateQuestions) {
    query = query.populate('questions', 'text type difficulty');
  }

  const chapter = await query.lean();
  if (!chapter) {
    throw new ApiError('Chapter not found.', 404);
  }
  return chapter;
};

/**
 * Updates an existing chapter.
 * @param chapterId The ID of the chapter to update.
 * @param updateData Data to update.
 * @returns The updated chapter document.
 * @throws ApiError if chapter not found or update fails due to validation.
 */
export const updateChapterService = async (
  chapterId: string,
  updateData: UpdateChapterData
): Promise<IChapter> => {
  try {
    const updatedChapter = await Chapter.findByIdAndUpdate(
      chapterId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedChapter) {
      throw new ApiError('Chapter not found or could not be updated.', 404);
    }
    return updatedChapter;
  } catch (error: any) {
    if (error.code === 11000) {
      throw new ApiError('Chapter with this order already exists in this training.', 409);
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to update chapter: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Deletes a chapter.
 * @param chapterId The ID of the chapter to delete.
 * @returns Success message.
 * @throws ApiError if chapter not found.
 */
export const deleteChapterService = async (chapterId: string): Promise<{ message: string }> => {
  const chapterToDelete = await Chapter.findById(chapterId);
  if (!chapterToDelete) {
    throw new ApiError('Chapter not found or could not be deleted.', 404);
  }

  // Remove chapter ID from its parent training's chapters array
  await Training.findByIdAndUpdate(
    chapterToDelete.training,
    { $pull: { chapters: chapterToDelete._id } }
  );

  // TODO: Implement cascading deletion for associated questions, and update enrollments if chapter was completed.
  await Chapter.deleteOne({ _id: chapterId });

  return { message: 'Chapter deleted successfully.' };
};
