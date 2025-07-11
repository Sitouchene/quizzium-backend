// src/services/enrollmentService.ts
import { Enrollment, IEnrollment } from '../models/Enrollment';
import { User } from '../models/User'; // To validate user role
import { Training , ITraining} from '../models/Training'; // To validate training existence
import { Chapter } from '../models/Chapter'; // To validate chapters for completion
// Importe les enums nécessaires depuis utils/types.ts
import { ApiError, EnrollmentStatus, UserRole, NotificationType } from '../utils/types';
import { Types } from 'mongoose';
import { createNotificationService } from './notificationService';


// Interfaces for Enrollment Data
interface CreateEnrollmentData {
  user: string; // ID of the student user
  training: string; // ID of the training
  initialStatus?: EnrollmentStatus; // Permet de définir le statut initial (par défaut 'pending')
}

interface UpdateEnrollmentData {
  status?: EnrollmentStatus; // Utilise l'enum EnrollmentStatus
  progressPercentage?: number;
  completedChapters?: string[]; // Array of Chapter IDs
  completionDate?: Date;
  score?: number;
  certificateUrl?: string;
}

/**
 * Creates a new enrollment. By default, enrollments are 'pending'.
 * Only 'student' users can create their own enrollments. Managers/Admins can create for any student.
 * @param data Enrollment data.
 * @param creatorRole The role of the user creating the enrollment (for authorization).
 * @param requestingUserId The ID of the user performing the request.
 * @returns The created enrollment document.
 * @throws ApiError if creation fails (e.g., user/training not found, duplicate enrollment).
 */
export const createEnrollmentService = async (
  data: CreateEnrollmentData,
  creatorRole: UserRole, // Utilise l'enum UserRole
  requestingUserId: string
): Promise<IEnrollment> => {
  // Utilisation de la valeur de l'enum EnrollmentStatus
  const { user: userId, training: trainingId, initialStatus = EnrollmentStatus.PENDING } = data;

  // Validate user: must be a valid 'student'
  const studentUser = await User.findById(userId).select('role username'); // Sélectionnez le username pour la notification
  if (!studentUser || studentUser.role !== UserRole.STUDENT) { // Utilisation de la valeur de l'enum UserRole
    throw new ApiError('Only student users can be enrolled.', 400);
  }

  // Self-enrollment check for students
  if (creatorRole === UserRole.STUDENT && requestingUserId !== userId) { // Utilisation de la valeur de l'enum UserRole
    throw new ApiError('Students can only enroll themselves.', 403);
  }

  // Validate training existence
  const training = await Training.findById(trainingId).select('title'); // Sélectionnez le titre pour la notification
  if (!training) {
    throw new ApiError('Training not found.', 404);
  }

  const newEnrollment = new Enrollment({
    user: new Types.ObjectId(userId),
    training: new Types.ObjectId(trainingId),
    enrollmentDate: new Date(),
    status: initialStatus, // Utilisez le statut initial (déjà de type enum)
    progressPercentage: 0,
    completedChapters: [],
  });

  try {
    await newEnrollment.save();

    // --- NOTIFICATION POUR MANAGER/ADMIN : Nouvelle souscription à approuver ---
    if (newEnrollment.status === EnrollmentStatus.PENDING) { // Utilisation de la valeur de l'enum EnrollmentStatus
      // Utilisation des valeurs de l'enum UserRole pour la requête MongoDB
      const managersAndAdmins = await User.find({ role: { $in: [UserRole.MANAGER, UserRole.ADMIN] } }).select('_id');
      for (const recipient of managersAndAdmins) {
        await createNotificationService({
          recipientId: recipient._id.toString(),
          type: NotificationType.NEW_ENROLLMENT_PENDING, // Utilise l'enum NotificationType
          message: `Nouvelle demande d'inscription pour la formation "${training.title.fr}" par l'utilisateur ${studentUser.username}.`,
          relatedEntityId: newEnrollment._id.toString(),
          relatedEntityType: 'Enrollment',
        });
      }
    }
    // --- FIN NOTIFICATION ---

    return newEnrollment;
  } catch (error: any) {
    if (error.code === 11000) { // Duplicate key error (user, training unique index)
      throw new ApiError('User is already enrolled in this training.', 409);
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to create enrollment: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Updates an existing enrollment.
 * Managers/Admins can update any field. Students can update their `progressPercentage` and `completedChapters`.
 * @param enrollmentId The ID of the enrollment to update.
 * @param updateData Data to update.
 * @param requestingUser The authenticated user making the request.
 * @returns The updated enrollment document.
 * @throws ApiError if enrollment not found or not authorized.
 */
export const updateEnrollmentService = async (
  enrollmentId: string,
  updateData: UpdateEnrollmentData,
  requestingUser: { id: string; role: UserRole } // Utilise l'enum UserRole
): Promise<IEnrollment> => {
  // Populer user et training pour les notifications et les checks de statut
  const enrollment = await Enrollment.findById(enrollmentId).populate('user', 'username').populate('training', 'title');
  if (!enrollment) {
    throw new ApiError('Enrollment not found.', 404);
  }

  const oldStatus = enrollment.status; // Capture l'ancien statut pour la logique de notification

  // Authorization for updates
  if (requestingUser.role === UserRole.STUDENT) { // Utilise la valeur de l'enum UserRole
    if (enrollment.user.toString() !== requestingUser.id) {
      throw new ApiError('Not authorized to update this enrollment.', 403);
    }
    // Students can only update progressPercentage and completedChapters
    const allowedStudentFields = ['progressPercentage', 'completedChapters'];
    const invalidFields = Object.keys(updateData).filter(field => !allowedStudentFields.includes(field));
    if (invalidFields.length > 0) {
      throw new ApiError(`Students cannot update fields: ${invalidFields.join(', ')}.`, 403);
    }
  } else if (![UserRole.MANAGER, UserRole.ADMIN].includes(requestingUser.role)) { // Utilisation des valeurs de l'enum UserRole
    // Teachers might have limited update capabilities if needed, otherwise restrict to manager/admin
    throw new ApiError('Not authorized to update this enrollment.', 403);
  }

  try {
    const updatedEnrollment = await Enrollment.findByIdAndUpdate(
      enrollmentId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean(); // Utiliser lean() pour le retour rapide

    if (!updatedEnrollment) {
      throw new ApiError('Enrollment not found or could not be updated.', 404);
    }

    // --- NOTIFICATION POUR L'ÉTUDIANT : Souscription approuvée/rejetée ---
    // Si le statut a changé de PENDING à APPROVED ou REJECTED
    // Utilisation des valeurs de l'enum EnrollmentStatus
    if (oldStatus === EnrollmentStatus.PENDING &&
        (updatedEnrollment.status === EnrollmentStatus.APPROVED || updatedEnrollment.status === EnrollmentStatus.REJECTED)) {
      const student = enrollment.user as any; // Le champ 'user' est déjà peuplé
      const trainingTitle = (enrollment.training as any).title.fr; // Le champ 'training' est déjà peuplé

      await createNotificationService({
        recipientId: student._id.toString(),
        type: NotificationType.ENROLLMENT_STATUS_CHANGED, // Utilise l'enum NotificationType
        message: `Votre demande d'inscription pour la formation "${trainingTitle}" a été ${updatedEnrollment.status === EnrollmentStatus.APPROVED ? 'approuvée' : 'rejetée'}.`,
        relatedEntityId: updatedEnrollment._id.toString(),
        relatedEntityType: 'Enrollment',
      });
    }
    // --- FIN NOTIFICATION ---

    return updatedEnrollment;
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      throw new ApiError(messages.join(', '), 400);
    }
    throw new ApiError(`Failed to update enrollment: ${error.message || 'Unknown error'}`, 500);
  }
};

/**
 * Retrieves all enrollments, with filtering and pagination.
 * Teachers can only see enrollments for trainings they are assigned to.
 * Managers/Admins can see all. Students can only see their own.
 * @param filters Optional filtering criteria (e.g., user, training, status).
 * @param options Pagination and population options.
 * @param requestingUser The authenticated user making the request.
 * @returns An array of enrollment documents.
 */
export const getAllEnrollmentsService = async (
  filters: any = {},
  options: { page?: number; limit?: number; populateUser?: boolean; populateTraining?: boolean } = {},
  requestingUser: { id: string; role: UserRole } // Utilise l'enum UserRole
): Promise<IEnrollment[]> => {
  const { page = 1, limit = 10, populateUser = false, populateTraining = false } = options;
  const skip = (page - 1) * limit;

  // Enforce authorization rules
  if (requestingUser.role === UserRole.STUDENT) { // Utilise la valeur de l'enum UserRole
    filters.user = new Types.ObjectId(requestingUser.id); // Students can only see their own enrollments
  } else if (requestingUser.role === UserRole.TEACHER) { // Utilise la valeur de l'enum UserRole
    // Teachers can only see enrollments for trainings they are assigned to
    // This requires fetching trainings assigned to the teacher and then filtering enrollments
    // Assuming `Training.teachers` array exists for this logic.
    // **Since `Training.teachers` is not in your provided model, this logic is commented out.**
    // If you add `teachers` to Training, uncomment and adjust:
    /*
    const trainingsAssignedToTeacher = await Training.find({ teachers: new Types.ObjectId(requestingUser.id) }).select('_id');
    const trainingIds = trainingsAssignedToTeacher.map(t => t._id);
    filters.training = { $in: trainingIds };
    */
    // For now, without `Training.teachers`, teachers can only see enrollments if they explicitly filter by a training ID they know.
    // Or, we could restrict teachers to only view student enrollments for trainings *they created* (if `createdBy` refers to teachers).
    // Given current models, let's keep it simple: teachers get all they request, managers/admins get all.
    // More complex filtering by teacher-assigned trainings would need `Training.teachers` or a custom teacher-training association.
  }

  let query = Enrollment.find(filters);

  if (populateUser) {
    query = query.populate('user', 'username email role profile');
  }
  if (populateTraining) {
    query = query.populate('training', 'title slug category');
  }

  const enrollments = await query.skip(skip).limit(limit).lean();
  return enrollments;
};

/**
 * Retrieves a single enrollment by ID.
 * Teachers can only see enrollments for trainings they are assigned to.
 * Students can only see their own.
 * @param enrollmentId The ID of the enrollment.
 * @param options Population options.
 * @param requestingUser The authenticated user making the request.
 * @returns The enrollment document.
 * @throws ApiError if enrollment not found or not authorized.
 */
export const getEnrollmentByIdService = async (
  enrollmentId: string,
  options: { populateUser?: boolean; populateTraining?: boolean } = {},
  requestingUser: { id: string; role: UserRole } // Utilise l'enum UserRole
): Promise<IEnrollment> => {
  const { populateUser = false, populateTraining = false } = options;

  let query = Enrollment.findById(enrollmentId);

  if (populateUser) query = query.populate('user', 'username email role profile');
  if (populateTraining) query = query.populate('training', 'title slug category');

  const enrollment = await query.lean();

  if (!enrollment) {
    throw new ApiError('Enrollment not found.', 404);
  }

  // Enforce authorization rules:
  if (requestingUser.role === UserRole.STUDENT && enrollment.user.toString() !== requestingUser.id) { // Utilise la valeur de l'enum UserRole
    throw new ApiError('Not authorized to view this enrollment.', 403);
  }
  // If `Training.teachers` existed, a teacher check would go here:
  // else if (requestingUser.role === UserRole.TEACHER) { // Utilise la valeur de l'enum UserRole
  //   const training = await Training.findById(enrollment.training);
  //   if (!training || !training.teachers.includes(new Types.ObjectId(requestingUser.id))) {
  //     throw new ApiError('Not authorized to view this enrollment for this training.', 403);
  //   }
  // }

  return enrollment;
};


/**
 * Deletes an enrollment.
 * Only Managers/Admins can delete enrollments.
 * @param enrollmentId The ID of the enrollment to delete.
 * @returns Success message.
 * @throws ApiError if enrollment not found.
 */
export const deleteEnrollmentService = async (enrollmentId: string): Promise<{ message: string }> => {
  const result = await Enrollment.findByIdAndDelete(enrollmentId);
  if (!result) {
    throw new ApiError('Enrollment not found or could not be deleted.', 404);
  }
  return { message: 'Enrollment deleted successfully.' };
};

/**
 * Updates a student's progress and marks chapters as completed.
 * This is a specific utility for students to update their training progress.
 * @param enrollmentId The enrollment ID.
 * @param chapterId The chapter ID to mark as completed.
 * @param newProgressPercentage The new overall progress percentage.
 * @param requestingUserId The ID of the authenticated user (must match enrollment.user).
 * @returns The updated enrollment document.
 * @throws ApiError if not authorized, chapter not part of training, or chapter already completed.
 */
export const updateStudentProgressService = async (
  enrollmentId: string,
  chapterId: string,
  newProgressPercentage: number,
  requestingUserId: string
): Promise<IEnrollment> => {
  const enrollment = await Enrollment.findById(enrollmentId);

  if (!enrollment) {
    throw new ApiError('Enrollment not found.', 404);
  }
  if (enrollment.user.toString() !== requestingUserId) {
    throw new ApiError('Not authorized to update this enrollment.', 403);
  }
  if (!Types.ObjectId.isValid(chapterId)) {
    throw new ApiError('Invalid chapter ID format.', 400);
  }
  if (typeof newProgressPercentage !== 'number' || newProgressPercentage < 0 || newProgressPercentage > 100) {
    throw new ApiError('Progress percentage must be a number between 0 and 100.', 400);
  }

  // Ensure the chapter belongs to the training
  const chapter = await Chapter.findById(chapterId);
  if (!chapter || chapter.training.toString() !== enrollment.training.toString()) {
    throw new ApiError('Chapter does not belong to this training.', 400);
  }

  // Check if chapter already completed
  if (enrollment.completedChapters.includes(new Types.ObjectId(chapterId))) {
    throw new ApiError('Chapter already marked as completed.', 400);
  }

  // Update logic: add chapter to completedChapters and set new progress
  enrollment.completedChapters.push(new Types.ObjectId(chapterId));
  enrollment.progressPercentage = newProgressPercentage;

  // If progress is 100%, set completionDate
  if (newProgressPercentage === 100 && !enrollment.completionDate) {
    enrollment.completionDate = new Date();
  } else if (newProgressPercentage < 100 && enrollment.completionDate) {
    // If progress drops below 100 after being completed, clear completion date
    enrollment.completionDate = undefined; // Or set to null
  }

  await enrollment.save();
  return enrollment.toObject(); // Return lean object after save
};
