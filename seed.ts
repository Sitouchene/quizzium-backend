// seed.ts
import mongoose, { Types } from 'mongoose'; // Import Types here for ObjectId casting
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User, IUser } from './src/models/User';
import { Training, ITraining } from './src/models/Training';
import { Chapter, IChapter } from './src/models/Chapter';
import { Question, IQuestion, IChoice } from './src/models/Question';
import { Enrollment, IEnrollment } from './src/models/Enrollment';
import { QuizSession, IQuizSession } from './src/models/QuizSession';
import { ILocalizedString, ILocalizedChoice, QuestionType } from './src/utils/types'; // Add ILocalizedChoice and QuestionType here

// Charge les variables d'environnement
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quizzium_db';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || 'manager123';
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'teacher123';
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD || 'student123';

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected for seeding...');

    // --- 1. Nettoyage des collections existantes ---
    console.log('Cleaning up existing collections...');
    await User.deleteMany({});
    await Training.deleteMany({});
    await Chapter.deleteMany({});
    await Question.deleteMany({});
    await Enrollment.deleteMany({});
    await QuizSession.deleteMany({});
    console.log('All collections cleared.');

    // --- 2. Création des utilisateurs ---
    console.log('Creating users...');
    const passwordSalt = await bcrypt.genSalt(10);

    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@quizzium.com',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, passwordSalt),
      role: 'admin',
      profile: { firstName: 'Super', lastName: 'Admin' },
      isActive: true,
    });

    const managerUser = await User.create({
      username: 'manager',
      email: 'manager@quizzium.com',
      passwordHash: await bcrypt.hash(MANAGER_PASSWORD, passwordSalt),
      role: 'manager',
      profile: { firstName: 'John', lastName: 'Manager' },
      isActive: true,
    });

    const teacherUser = await User.create({
      username: 'teacher',
      email: 'teacher@quizzium.com',
      passwordHash: await bcrypt.hash(TEACHER_PASSWORD, passwordSalt),
      role: 'teacher',
      profile: { firstName: 'Alice', lastName: 'Professor' },
      isActive: true,
    });

    const studentUser1 = await User.create({
      username: 'student1',
      email: 'student1@quizzium.com',
      passwordHash: await bcrypt.hash(STUDENT_PASSWORD, passwordSalt),
      role: 'student',
      profile: { firstName: 'Bob', lastName: 'Student' },
      isActive: true,
    });

    const studentUser2 = await User.create({
      username: 'student2',
      email: 'student2@quizzium.com',
      passwordHash: await bcrypt.hash(STUDENT_PASSWORD, passwordSalt),
      role: 'student',
      profile: { firstName: 'Charlie', lastName: 'Student' },
      isActive: true,
    });
    console.log('Users created.');

    // --- 3. Création des formations et chapitres ---
    console.log('Creating trainings and chapters...');

    // Formation: World Capitals
    const worldCapitalsTraining = await Training.create({
      title: { fr: 'Capitales du Monde', en: 'World Capitals' },
      description: { fr: 'Apprenez les capitales des pays par continent.', en: 'Learn country capitals by continent.' },
      slug: 'world-capitals',
      category: 'Geography',
      level: 'beginner',
      createdBy: teacherUser._id,
      isPublished: true,
      durationHours: 10,
      thumbnailUrl: 'https://example.com/world_capitals.jpg',
      tags: ['geography', 'capitals', 'world'],
    });

    const continents = [
      { name: { fr: 'Afrique', en: 'Africa' }, slug: 'africa' },
      { name: { fr: 'Europe', en: 'Europe' }, slug: 'europe' },
      { name: { fr: 'Asie', en: 'Asia' }, slug: 'asia' },
      { name: { fr: 'Amérique du Nord', en: 'North America' }, slug: 'north-america' },
      { name: { fr: 'Amérique du Sud', en: 'South America' }, slug: 'south-america' },
      { name: { fr: 'Océanie', en: 'Oceania' }, slug: 'oceania' },
    ];

    const worldCapitalsChapters: IChapter[] = [];
    for (let i = 0; i < continents.length; i++) {
      const chapter = await Chapter.create({
        title: continents[i].name,
        description: { fr: `Chapitre sur les capitales d'${continents[i].name.fr}.`, en: `Chapter on capitals of ${continents[i].name.en}.` },
        training: worldCapitalsTraining._id,
        order: i + 1,
      });
      worldCapitalsChapters.push(chapter);
      worldCapitalsTraining.chapters.push(chapter._id as Types.ObjectId); // Explicit cast
    }
    await worldCapitalsTraining.save(); // Sauvegarder la formation mise à jour avec les chapitres

    // Formation: Prix Nobel
    const nobelPrizeTraining = await Training.create({
      title: { fr: 'Prix Nobel', en: 'Nobel Prizes' },
      description: { fr: 'Testez vos connaissances sur les lauréats des Prix Nobel.', en: 'Test your knowledge on Nobel Prize laureates.' },
      slug: 'nobel-prizes',
      category: 'General Knowledge',
      level: 'intermediate',
      createdBy: teacherUser._id,
      isPublished: true,
      durationHours: 8,
      thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8d/Nobel_medal.png/512px-Nobel_medal.png',
      tags: ['history', 'science', 'literature', 'peace'],
    });

    const nobelDomains = [
      { name: { fr: 'Paix', en: 'Peace' }, slug: 'peace' },
      { name: { fr: 'Littérature', en: 'Literature' }, slug: 'literature' },
      { name: { fr: 'Physique', en: 'Physics' }, slug: 'physics' },
      { name: { fr: 'Chimie', en: 'Chemistry' }, slug: 'chemistry' },
      { name: { fr: 'Médecine', en: 'Medicine' }, slug: 'medicine' },
      { name: { fr: 'Économie', en: 'Economics' }, slug: 'economics' },
    ];

    const nobelPrizeChapters: IChapter[] = [];
    for (let i = 0; i < nobelDomains.length; i++) {
      const chapter = await Chapter.create({
        title: nobelDomains[i].name,
        description: { fr: `Chapitre sur le Prix Nobel de ${nobelDomains[i].name.fr}.`, en: `Chapter on the Nobel Prize in ${nobelDomains[i].name.en}.` },
        training: nobelPrizeTraining._id,
        order: i + 1,
      });
      nobelPrizeChapters.push(chapter);
      nobelPrizeTraining.chapters.push(chapter._id as Types.ObjectId); // Explicit cast
    }
    await nobelPrizeTraining.save();
    console.log('Trainings and chapters created.');

    // --- 4. Création des questions ---
    console.log('Creating questions...');
    const questions: IQuestion[] = [];

    // 50 questions pour World Capitals (principalement QCM)
    interface CapitalQuestionData {
        fr: string;
        en: string;
        answer: string;
        type?: QuestionType | 'TrueFalse' | 'QCM_Generic'; // Extend with specific types for seed logic
    }

    const capitalQuestionsData: CapitalQuestionData[] = [
      { fr: 'Quelle est la capitale de la France ?', en: 'What is the capital of France?', answer: 'Paris' },
      { fr: 'Quelle est la capitale du Canada ?', en: 'What is the capital of Canada?', answer: 'Ottawa' },
      { fr: 'Quelle est la capitale de l\'Égypte ?', en: 'What is the capital of Egypt?', answer: 'Le Caire' },
      { fr: 'Quelle est la capitale du Japon ?', en: 'What is the capital of Japan?', answer: 'Tokyo' },
      { fr: 'Quelle est la capitale de l\'Australie ?', en: 'What is the capital of Australia?', answer: 'Canberra' },
      { fr: 'Quelle est la capitale du Brésil ?', en: 'What is the capital of Brazil?', answer: 'Brasilia' },
      { fr: 'Quelle est la capitale de l\'Argentine ?', en: 'What is the capital of Argentina?', answer: 'Buenos Aires' },
      { fr: 'Quelle est la capitale de l\'Afrique du Sud ?', en: 'What is the capital of South Africa?', answer: 'Pretoria' },
      { fr: 'Quelle est la capitale de l\'Allemagne ?', en: 'What is the capital of Germany?', answer: 'Berlin' },
      { fr: 'Quelle est la capitale de l\'Inde ?', en: 'What is the capital of India?', answer: 'New Delhi' },
      { fr: 'Combien y a-t-il de continents sur Terre ?', en: 'How many continents are there on Earth?', answer: '7', type: 'Calcul' }, // Calcul
      { fr: 'En quelle année la capitale des États-Unis est-elle devenue Washington D.C. ?', en: 'In what year did the capital of the United States become Washington D.C.?', answer: '1790', type: 'Calcul' }, // Calcul
      { fr: 'Quelle est la capitale de l\'Italie ?', en: 'What is the capital of Italy?', answer: 'Rome' },
      { fr: 'Quelle est la capitale de l\'Espagne ?', en: 'What is the capital of Spain?', answer: 'Madrid' },
      { fr: 'Quelle est la capitale de la Chine ?', en: 'What is the capital of China?', answer: 'Beijing' },
      { fr: 'Quelle est la capitale de la Russie ?', en: 'What is the capital of Russia?', answer: 'Moscou' },
      { fr: 'Quelle est la capitale du Maroc ?', en: 'What is the capital of Morocco?', answer: 'Rabat' },
      { fr: 'Quelle est la capitale du Nigéria ?', en: 'What is the capital of Nigeria?', answer: 'Abuja' },
      { fr: 'Quelle est la capitale du Pérou ?', en: 'What is the capital of Peru?', answer: 'Lima' },
      { fr: 'Quelle est la capitale du Mexique ?', en: 'What is the capital of Mexico?', answer: 'Mexico City' },
      { fr: 'La capitale de l\'Éthiopie est Addis-Abeba, vrai ou faux ?', en: 'The capital of Ethiopia is Addis Ababa, true or false?', answer: 'Vrai', type: 'TrueFalse' },
      { fr: 'Combien de pays y a-t-il en Europe (environ) ?', en: 'Roughly, how many countries are there in Europe?', answer: '50', type: 'Calcul' }, // Calcul
      { fr: 'Quel pays d\'Amérique du Sud a pour capitale Santiago ?', en: 'Which South American country has Santiago as its capital?', answer: 'Chili' },
      { fr: 'Dans quel continent se trouve le Caire ?', en: 'Which continent is Cairo located in?', answer: 'Afrique', type: 'QCM_Generic' }, // Generic QCM as it's not a direct capital question
      { fr: 'Combien de capitales principales y a-t-il en Afrique du Sud ?', en: 'How many main capitals does South Africa have?', answer: '3', type: 'Calcul' }, // Calcul
    ];

    while (capitalQuestionsData.length < 50) {
      capitalQuestionsData.push({
        fr: `Question supplémentaire sur les capitales ${capitalQuestionsData.length + 1}.`,
        en: `Additional capital question ${capitalQuestionsData.length + 1}.`,
        answer: 'Réponse générale', // Default answer
        type: 'QCM'
      });
    }

    const allPossibleCapitals = ['Paris', 'Ottawa', 'Le Caire', 'Tokyo', 'Canberra', 'Brasilia', 'Buenos Aires', 'Pretoria', 'Berlin', 'New Delhi', 'Londres', 'Rome', 'Madrid', 'Beijing', 'Moscou', 'Rabat', 'Abuja', 'Lima', 'Mexico City', 'Santiago', 'Addis Abeba'];
    const allPossibleContinents = ['Afrique', 'Europe', 'Asie', 'Amérique du Nord', 'Amérique du Sud', 'Océanie'];
    const allPossibleCountries = ['France', 'Canada', 'Égypte', 'Japon', 'Australie', 'Brésil', 'Argentine', 'Afrique du Sud', 'Allemagne', 'Inde', 'Italie', 'Espagne', 'Chine', 'Russie', 'Maroc', 'Nigéria', 'Pérou', 'Mexique', 'Chili', 'Éthiopie'];


    let chapterIndex = 0;
    for (let i = 0; i < 50; i++) {
      const qData = capitalQuestionsData[i];
      const currentChapter = worldCapitalsChapters[chapterIndex % worldCapitalsChapters.length];

      let question: IQuestion;
      if (qData.type === 'Calcul') {
        question = await Question.create({
          chapter: currentChapter._id as Types.ObjectId, // Explicit cast
          text: { fr: qData.fr, en: qData.en },
          type: 'Calcul',
          correctAnswerFormula: qData.answer,
          difficulty: 'easy',
          explanation: { fr: `La réponse est ${qData.answer}.`, en: `The answer is ${qData.answer}.` },
          tags: ['geography', 'numbers'],
        });
      } else {
        let finalChoices: IChoice[] = [];
        if (qData.type === 'TrueFalse') {
            finalChoices.push({ text: { fr: 'Vrai', en: 'True' }, isCorrect: qData.answer === 'Vrai' });
            finalChoices.push({ text: { fr: 'Faux', en: 'False' }, isCorrect: qData.answer === 'Faux' });
        } else {
            // Add correct choice
            finalChoices.push({ text: { fr: qData.answer, en: qData.answer }, isCorrect: true });

            // Add 3 random incorrect choices (ensure uniqueness and relevance)
            let incorrectCandidates: string[] = [];
            if (qData.fr.includes('capitale')) {
                incorrectCandidates = allPossibleCapitals.filter(c => c !== qData.answer);
            } else if (qData.fr.includes('pays') || qData.fr.includes('country')) {
                incorrectCandidates = allPossibleCountries.filter(c => c !== qData.answer);
            } else if (qData.fr.includes('continent')) {
                incorrectCandidates = allPossibleContinents.filter(c => c !== qData.answer);
            } else {
                // Fallback for generic questions
                incorrectCandidates = ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'].filter(o => o !== qData.answer);
            }

            const chosenIncorrect: string[] = [];
            while (chosenIncorrect.length < 3 && incorrectCandidates.length > 0) {
                const randomIndex = Math.floor(Math.random() * incorrectCandidates.length);
                const incorrectChoice = incorrectCandidates.splice(randomIndex, 1)[0];
                chosenIncorrect.push(incorrectChoice);
            }

            chosenIncorrect.forEach(choice => {
                finalChoices.push({ text: { fr: choice, en: choice }, isCorrect: false });
            });

            // Shuffle choices to randomize order
            finalChoices.sort(() => Math.random() - 0.5);
        }


        question = await Question.create({
          chapter: currentChapter._id as Types.ObjectId, // Explicit cast
          text: { fr: qData.fr, en: qData.en },
          type: 'QCM',
          choices: finalChoices,
          difficulty: i % 3 === 0 ? 'hard' : (i % 2 === 0 ? 'medium' : 'easy'),
          explanation: { fr: `L'explication pour ${qData.fr}. La bonne réponse était ${qData.answer}.`, en: `Explanation for ${qData.en}. The correct answer was ${qData.answer}.` },
          tags: ['capitals', currentChapter.title.en.toLowerCase()],
        });
      }
      questions.push(question);
      currentChapter.questions.push(question._id as Types.ObjectId); // Explicit cast
      await currentChapter.save();
      chapterIndex++;
    }


    // 50 questions pour Prix Nobel (uniquement en français, avec QCM et Calcul)
    interface NobelQuestionData {
        fr: string;
        answer: string;
        type?: QuestionType | 'TrueFalse';
    }

    const nobelQuestionsData: NobelQuestionData[] = [
      { fr: 'Quel scientifique a reçu le prix Nobel de physique en 1921 pour sa théorie de l\'effet photoélectrique ?', answer: 'Albert Einstein', type: 'QCM' },
      { fr: 'En quelle année Marie Curie a-t-elle reçu son deuxième prix Nobel (de Chimie) ?', answer: '1911', type: 'Calcul' },
      { fr: 'Quel est le prix Nobel décerné par le Comité norvégien du Nobel ?', answer: 'Prix Nobel de la Paix', type: 'QCM' },
      { fr: 'Combien de lauréats différents ont reçu le prix Nobel de la Paix depuis sa création ? (approximation en 2024)', answer: '141', type: 'Calcul' },
      { fr: 'Qui a écrit "Cent ans de solitude" et a reçu le prix Nobel de littérature ?', answer: 'Gabriel García Márquez', type: 'QCM' },
      { fr: 'En quelle année le prix Nobel d\'économie a-t-il été créé ?', answer: '1968', type: 'Calcul' },
      { fr: 'Quel domaine de la science a été récompensé par le prix Nobel de la découverte de la pénicilline ?', answer: 'Médecine', type: 'QCM' },
      { fr: 'Quel président américain a reçu le prix Nobel de la Paix ?', answer: 'Barack Obama', type: 'QCM' },
      { fr: 'Combien de femmes ont reçu le prix Nobel de physique jusqu\'à présent ? (au moment de votre conception - environ)', answer: '5', type: 'Calcul' },
      { fr: 'Quelle est la nationalité de la plupart des lauréats du prix Nobel ?', answer: 'Américaine', type: 'QCM' },
      { fr: 'Le prix Nobel de chimie est décerné par l\'Académie royale des sciences de Suède, vrai ou faux ?', answer: 'Vrai', type: 'TrueFalse' },
      { fr: 'Combien de fois a-t-on interrompu la remise des Prix Nobel ? (en termes d\'années)', answer: '6', type: 'Calcul' },
      { fr: 'Qui a reçu le prix Nobel de la Paix en 1964 pour sa lutte contre la ségrégation ?', answer: 'Martin Luther King Jr.', type: 'QCM' },
      { fr: 'Quel prix Nobel n\'est pas mentionné dans le testament d\'Alfred Nobel ?', answer: 'Prix de la Banque de Suède en sciences économiques en mémoire d\'Alfred Nobel', type: 'QCM' },
      { fr: 'Combien de Prix Nobel peut recevoir une seule personne au maximum ?', answer: '2', type: 'Calcul' },
      { fr: 'En quelle année a été décerné le premier prix Nobel ?', answer: '1901', type: 'Calcul' },
      { fr: 'Quel est le nom complet du prix Nobel d\'économie ?', answer: 'Prix de la Banque de Suède en sciences économiques en mémoire d\'Alfred Nobel', type: 'QCM' },
      { fr: 'Combien de scientifiques ont partagé le prix Nobel de physique pour la découverte du transistor ?', answer: '3', type: 'Calcul' },
      { fr: 'Quel est le critère principal pour recevoir le prix Nobel de la Paix ?', answer: 'Promotion de la fraternité entre les nations', type: 'QCM' },
      { fr: 'La cérémonie des prix Nobel a lieu chaque année le 10 décembre, vrai ou faux ?', answer: 'Vrai', type: 'TrueFalse' },
    ];

    while (nobelQuestionsData.length < 50) {
        nobelQuestionsData.push({ fr: `Question supplémentaire sur les Prix Nobel ${nobelQuestionsData.length + 1}.`, answer: `Réponse Y${nobelQuestionsData.length + 1}`, type: (nobelQuestionsData.length % 3 === 0 ? 'Calcul' : 'QCM') });
    }

    const nobelQcmAnswers = [
        'Albert Einstein', 'Prix Nobel de la Paix', 'Gabriel García Márquez', 'Médecine', 'Barack Obama',
        'Américaine', 'Martin Luther King Jr.', 'Prix de la Banque de Suède en sciences économiques en mémoire d\'Alfred Nobel',
        'Promotion de la fraternité entre les nations', 'Vrai', 'Faux', 'Autre lauréat 1', 'Autre lauréat 2', 'Autre prix',
        'Sciences', 'Littérature', 'Chimie', 'Physique', 'Économie', 'Johannesburg', 'Washington D.C.' // Add more diverse incorrect answers
    ];

    chapterIndex = 0;
    for (let i = 0; i < 50; i++) {
      const qData = nobelQuestionsData[i];
      const currentChapter = nobelPrizeChapters[chapterIndex % nobelPrizeChapters.length];

      let question: IQuestion;
      if (qData.type === 'Calcul') {
        question = await Question.create({
          chapter: currentChapter._id as Types.ObjectId, // Explicit cast
          text: { fr: qData.fr, en: qData.fr }, // Français seulement pour Nobel
          type: 'Calcul',
          correctAnswerFormula: qData.answer,
          difficulty: 'medium',
          explanation: { fr: `La réponse numérique est ${qData.answer}.`, en: `The numeric answer is ${qData.answer}.` },
          tags: ['nobel', 'numbers', currentChapter.title.fr.toLowerCase()],
        });
      } else {
        let finalChoices: IChoice[] = [];
        if (qData.type === 'TrueFalse') {
            finalChoices.push({ text: { fr: 'Vrai', en: 'True' }, isCorrect: qData.answer === 'Vrai' });
            finalChoices.push({ text: { fr: 'Faux', en: 'False' }, isCorrect: qData.answer === 'Faux' });
        } else {
            // Add correct choice
            finalChoices.push({ text: { fr: qData.answer, en: qData.answer }, isCorrect: true });

            // Add 3 random incorrect choices (ensure uniqueness)
            const incorrectCandidates = nobelQcmAnswers.filter(c => c !== qData.answer);
            const chosenIncorrect: string[] = [];
            while (chosenIncorrect.length < 3 && incorrectCandidates.length > 0) {
                const randomIndex = Math.floor(Math.random() * incorrectCandidates.length);
                const incorrectChoice = incorrectCandidates.splice(randomIndex, 1)[0];
                chosenIncorrect.push(incorrectChoice);
            }

            chosenIncorrect.forEach(choice => {
                finalChoices.push({ text: { fr: choice, en: choice }, isCorrect: false });
            });

            // Shuffle choices
            finalChoices.sort(() => Math.random() - 0.5);
        }

        question = await Question.create({
          chapter: currentChapter._id as Types.ObjectId, // Explicit cast
          text: { fr: qData.fr, en: qData.fr }, // Uniquement le français pour Nobel
          type: 'QCM',
          choices: finalChoices,
          difficulty: i % 2 === 0 ? 'medium' : 'easy',
          explanation: { fr: `Explication pour ${qData.fr}. La bonne réponse était ${qData.answer}.`, en: `Explanation for ${qData.fr}. The correct answer was ${qData.answer}.` },
          tags: ['nobel', currentChapter.title.fr.toLowerCase()],
        });
      }
      questions.push(question);
      currentChapter.questions.push(question._id as Types.ObjectId); // Explicit cast
      await currentChapter.save();
      chapterIndex++;
    }

    console.log('Questions created.');

    // --- 5. Création d'une inscription de test (optionnel) ---
    console.log('Creating sample enrollment...');
    await Enrollment.create({
      user: studentUser1._id,
      training: worldCapitalsTraining._id,
      status: 'approved',
      progressPercentage: 50,
      completedChapters: [worldCapitalsChapters[0]._id as Types.ObjectId], // Explicit cast
    });
    console.log('Sample enrollment created.');

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
};

seedDatabase();