export type Role = 'athlete' | 'guardian' | 'coach' | 'dietitian' | 'admin';

export interface SwimmerFormData {
  // أساسية
  fullName: string;
  gender: string;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  bodyFatPercent?: number;
  waistCm?: number;
  country?: string;
  timezone?: string;
  ageGroup?: string;
  swimmerLevel?: string;
  specialty?: string;
  mainDistances?: string;
  personalBests?: string;
  nextCompetitionDate?: string;

  // تدريب
  swimSessionsPerWeek?: number;
  swimMinutesPerSession?: number;
  trainingIntensity?: string;
  swimDistancePerSession?: number;
  gymSessionsPerWeek?: number;
  gymMinutesPerSession?: number;
  gymType?: string;
  restDays?: string;
  trainingTime?: string;
  hasDoubleTraining: boolean;
  sleepHours?: number;
  dailyActivityLevel?: string;

  // غذاء وصحة
  goal?: string;
  allergies?: string;
  dislikedFoods?: string;
  dietType?: string;
  preferredMealsPerDay?: number;
  budgetLevel?: string;
  availableFoods?: string;
  chronicConditions?: string;
  medications?: string;
  currentInjuries?: string;
  digestiveIssues?: string;
  pregnancyStatus?: string;
  isMinor: boolean;
  guardianName?: string;
  guardianPhone?: string;
  notes?: string;
}

export interface NutritionResult {
  bmi?: number;
  bmiCategory?: string;
  bmr?: number;
  tdee?: number;
  calories?: number;
  calorieMin?: number;
  calorieMax?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  waterMl?: number;
  trainingWaterMl?: number;
  sodiumMg?: number;
  proteinPct?: number;
  carbsPct?: number;
  fatPct?: number;
  mealCalories?: Record<string, number>;
  trainingCalories?: { swimKcal?: number; gymKcal?: number; total?: number };
  formula?: string;
  recommendations?: Record<string, string>;
}

export interface AnalyzedFood {
  nameAr: string;
  nameEn?: string;
  grams?: number;
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fiberG?: number;
  sodiumMg?: number;
}

export interface MealAnalysisResult {
  provider: string;
  isEstimate: boolean;
  confidence?: number;
  foods: AnalyzedFood[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalFiberG: number;
  totalSodiumMg: number;
  needsReview?: boolean;
  notes?: string;
  raw?: unknown;
}

export interface NotificationPrefForm {
  breakfastTime?: string;
  lunchTime?: string;
  dinnerTime?: string;
  snackTimes?: string;
  preWorkoutTime?: string;
  postWorkoutTime?: string;
  waterInterval?: number;
  trainingTime?: string;
  sleepTime?: string;
  weighInTime?: string;
  competitionReminderDays?: number;
  planReviewReminderDays?: number;
  soundEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  smartAlerts: boolean;
  days?: string;
}
