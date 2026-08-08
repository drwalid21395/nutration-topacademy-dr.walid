import { z } from 'zod';

const email = z.string().trim().email('بريد إلكتروني غير صالح').max(200);

export const passwordSchema = z
  .string()
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  .max(100)
  .regex(/[a-zA-Z]/, 'يجب أن تحتوي على حرف إنجليزي واحد على الأقل')
  .regex(/[0-9]/, 'يجب أن تحتوي على رقم واحد على الأقل');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'الاسم قصير جدًا').max(120),
  email,
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  password: passwordSchema,
  role: z.enum(['athlete', 'guardian', 'coach', 'dietitian', 'admin']),
  isAdult: z.boolean().optional(),
  parentName: z.string().trim().max(120).optional(),
  parentPhone: z.string().trim().max(30).optional(),
  acceptTerms: z.boolean().refine((v) => v === true, 'يجب الموافقة على شروط الاستخدام'),
  acceptPrivacy: z.boolean().refine((v) => v === true, 'يجب الموافقة على سياسة الخصوصية'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'اسم السباح قصير جدًا — أدخل حرفين على الأقل').max(120),
  gender: z.enum(['male', 'female']),
  birthDate: z.string().optional().or(z.literal('')),
  heightCm: z.coerce.number().min(80, 'طول غير منطقي').max(250, 'طول غير منطقي').optional(),
  weightKg: z.coerce.number().min(15, 'وزن غير منطقي').max(400, 'وزن غير منطقي').optional(),
  targetWeightKg: z.coerce.number().min(15).max(400).optional(),
  bodyFatPercent: z.coerce.number().min(1).max(70).optional(),
  waistCm: z.coerce.number().min(30).max(200).optional(),
  country: z.string().trim().max(100).optional().or(z.literal('')),
  timezone: z.string().trim().max(60).optional().or(z.literal('')),
  ageGroup: z.string().optional().or(z.literal('')),
  swimmerLevel: z.string().optional().or(z.literal('')),
  specialty: z.string().optional().or(z.literal('')),
  mainDistances: z.string().optional().or(z.literal('')),
  personalBests: z.string().optional().or(z.literal('')),
  nextCompetitionDate: z.string().optional().or(z.literal('')),

  swimSessionsPerWeek: z.coerce.number().min(0).max(20).optional(),
  swimMinutesPerSession: z.coerce.number().min(0).max(480).optional(),
  trainingIntensity: z.string().optional().or(z.literal('')),
  swimDistancePerSession: z.coerce.number().min(0).max(30000).optional(),
  gymSessionsPerWeek: z.coerce.number().min(0).max(14).optional(),
  gymMinutesPerSession: z.coerce.number().min(0).max(480).optional(),
  gymType: z.string().optional().or(z.literal('')),
  restDays: z.string().optional().or(z.literal('')),
  trainingTime: z.string().optional().or(z.literal('')),
  hasDoubleTraining: z.boolean().optional().default(false),
  sleepHours: z.coerce.number().min(1).max(24).optional(),
  dailyActivityLevel: z.string().optional().or(z.literal('')),

  goal: z.string().optional().or(z.literal('')),
  allergies: z.string().optional().or(z.literal('')),
  dislikedFoods: z.string().optional().or(z.literal('')),
  dietType: z.string().optional().or(z.literal('')),
  preferredMealsPerDay: z.coerce.number().min(2).max(8).optional(),
  budgetLevel: z.string().optional().or(z.literal('')),
  availableFoods: z.string().optional().or(z.literal('')),
  chronicConditions: z.string().optional().or(z.literal('')),
  medications: z.string().optional().or(z.literal('')),
  currentInjuries: z.string().optional().or(z.literal('')),
  digestiveIssues: z.string().optional().or(z.literal('')),
  pregnancyStatus: z.string().optional().or(z.literal('')),
  isMinor: z.boolean().optional().default(false),
  guardianName: z.string().optional().or(z.literal('')),
  guardianPhone: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export type ProfileInput = z.infer<typeof profileSchema>;
