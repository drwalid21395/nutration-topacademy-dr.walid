/**
 * قاعدة بيانات الطعام الأساسية — أطعمة عربية شائعة ببيانات غذائية تقريبية
 * لكل 100 جرام أو بحجم الحصة المذكور. تُستكمل لاحقًا عبر استيراد قواعد موثوقة.
 */
import type { Prisma } from '@prisma/client';

export type FoodSeed = {
  nameAr: string;
  nameEn?: string;
  category: string;
  portionLabel: string;
  gramsPerPortion: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarsG?: number;
  sodiumMg?: number;
  allergens?: string;
  isPreWorkout?: boolean;
  isPostWorkout?: boolean;
  isCompetition?: boolean;
  isKidFriendly?: boolean;
  isVegetarian?: boolean;
  hasLactose?: boolean;
  hasGluten?: boolean;
  isCommon?: boolean;
};

export const CATEGORIES: Prisma.FoodCategoryCreateInput[] = [
  { nameAr: 'لحوم ودواجن وأسماك', nameEn: 'Meat, Poultry & Fish', sortOrder: 1 },
  { nameAr: 'ألبان وبيض', nameEn: 'Dairy & Eggs', sortOrder: 2 },
  { nameAr: 'بقوليات', nameEn: 'Legumes', sortOrder: 3 },
  { nameAr: 'حبوب ونشويات', nameEn: 'Grains & Starches', sortOrder: 4 },
  { nameAr: 'خضروات', nameEn: 'Vegetables', sortOrder: 5 },
  { nameAr: 'فواكه', nameEn: 'Fruits', sortOrder: 6 },
  { nameAr: 'مكسرات وبذور', nameEn: 'Nuts & Seeds', sortOrder: 7 },
  { nameAr: 'زيوت ودهون', nameEn: 'Fats & Oils', sortOrder: 8 },
  { nameAr: 'مشروبات', nameEn: 'Beverages', sortOrder: 9 },
  { nameAr: 'وجبات عربية جاهزة', nameEn: 'Arabic Meals', sortOrder: 10 },
  { nameAr: 'وجبات خفيفة وحلويات', nameEn: 'Snacks & Sweets', sortOrder: 11 },
];

export const FOODS: FoodSeed[] = [
  // ---- بروتين ----
  { nameAr: 'صدر دجاج مشوي', nameEn: 'Grilled Chicken Breast', category: 'لحوم ودواجن وأسماك', portionLabel: 'قطعة (150 جم)', gramsPerPortion: 150, calories: 248, proteinG: 46.5, carbsG: 0, fatG: 5.4, sodiumMg: 120, isPreWorkout: false, isPostWorkout: true, isCompetition: false, isCommon: true },
  { nameAr: 'لحم بقري قليل الدهن', nameEn: 'Lean Beef', category: 'لحوم ودواجن وأسماك', portionLabel: 'قطعة (120 جم)', gramsPerPortion: 120, calories: 180, proteinG: 26, carbsG: 0, fatG: 8, sodiumMg: 65, isPostWorkout: true, isCompetition: false, isCommon: true },
  { nameAr: 'سمك تونة بالزيت', nameEn: 'Tuna in Oil', category: 'لحوم ودواجن وأسماك', portionLabel: 'علبة صغيرة (100 جم)', gramsPerPortion: 100, calories: 144, proteinG: 24, carbsG: 0, fatG: 5, sodiumMg: 380, isPostWorkout: true, isCompetition: false, isCommon: true },
  { nameAr: 'سمك مشوي (بوري/بلطي)', nameEn: 'Grilled Fish', category: 'لحوم ودواجن وأسماك', portionLabel: 'سمكة متوسطة (150 جم)', gramsPerPortion: 150, calories: 220, proteinG: 30, carbsG: 0, fatG: 10, sodiumMg: 90, isPostWorkout: true, isCommon: true },
  { nameAr: 'سلمون مشوي', nameEn: 'Grilled Salmon', category: 'لحوم ودواجن وأسماك', portionLabel: 'قطعة (140 جم)', gramsPerPortion: 140, calories: 290, proteinG: 32, carbsG: 0, fatG: 17, sodiumMg: 90, isPostWorkout: true },
  { nameAr: 'لحم ضأن مشوي', nameEn: 'Grilled Lamb', category: 'لحوم ودواجن وأسماك', portionLabel: 'قطعة (120 جم)', gramsPerPortion: 120, calories: 270, proteinG: 24, carbsG: 0, fatG: 19, sodiumMg: 70, isCommon: true },

  // ---- ألبان وبيض ----
  { nameAr: 'بيضة مسلوقة', nameEn: 'Boiled Egg', category: 'ألبان وبيض', portionLabel: 'بيضة (50 جم)', gramsPerPortion: 50, calories: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3, sodiumMg: 62, isPreWorkout: false, isPostWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'زبادي يوناني', nameEn: 'Greek Yogurt', category: 'ألبان وبيض', portionLabel: 'عبوة (170 جم)', gramsPerPortion: 170, calories: 130, proteinG: 16, carbsG: 7, fatG: 4, sugarsG: 6, sodiumMg: 65, hasLactose: true, isPostWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'حليب كامل الدسم', nameEn: 'Whole Milk', category: 'ألبان وبيض', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 146, proteinG: 7.9, carbsG: 11.5, fatG: 7.9, sugarsG: 11.5, sodiumMg: 110, hasLactose: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'حليب منزوع الدسم', nameEn: 'Skim Milk', category: 'ألبان وبيض', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 83, proteinG: 8.3, carbsG: 12.5, fatG: 0.2, sugarsG: 12.5, sodiumMg: 125, hasLactose: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'جبنة قريش', nameEn: 'Cottage Cheese', category: 'ألبان وبيض', portionLabel: 'كوب (150 جم)', gramsPerPortion: 150, calories: 147, proteinG: 20, carbsG: 5, fatG: 5, sodiumMg: 500, hasLactose: true, isPostWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'جبنة شيدر', nameEn: 'Cheddar Cheese', category: 'ألبان وبيض', portionLabel: 'شريحة (28 جم)', gramsPerPortion: 28, calories: 113, proteinG: 7, carbsG: 0.9, fatG: 9.3, sodiumMg: 174, hasLactose: true, isKidFriendly: true, isVegetarian: true },

  // ---- بقوليات ----
  { nameAr: 'عدس مطبوخ', nameEn: 'Cooked Lentils', category: 'بقوليات', portionLabel: 'كوب (200 جم)', gramsPerPortion: 200, calories: 230, proteinG: 18, carbsG: 40, fatG: 0.8, fiberG: 16, isPostWorkout: false, isVegetarian: true, isCommon: true },
  { nameAr: 'حمص مسلوق', nameEn: 'Boiled Chickpeas', category: 'بقوليات', portionLabel: 'كوب (164 جم)', gramsPerPortion: 164, calories: 269, proteinG: 14.5, carbsG: 45, fatG: 4.3, fiberG: 12.5, isVegetarian: true, isCommon: true },
  { nameAr: 'فول مدمس', nameEn: 'Fava Beans', category: 'بقوليات', portionLabel: 'طبق (150 جم)', gramsPerPortion: 150, calories: 165, proteinG: 10, carbsG: 27, fatG: 2, fiberG: 8, isVegetarian: true, isCommon: true },
  { nameAr: 'فاصوليا بيضاء', nameEn: 'White Beans', category: 'بقوليات', portionLabel: 'كوب (180 جم)', gramsPerPortion: 180, calories: 230, proteinG: 15, carbsG: 41, fatG: 1, fiberG: 11, isVegetarian: true },

  // ---- حبوب ونشويات ----
  { nameAr: 'أرز أبيض مطبوخ', nameEn: 'Cooked White Rice', category: 'حبوب ونشويات', portionLabel: 'كوب (158 جم)', gramsPerPortion: 158, calories: 205, proteinG: 4.3, carbsG: 45, fatG: 0.4, sodiumMg: 2, isPreWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'أرز بني مطبوخ', nameEn: 'Cooked Brown Rice', category: 'حبوب ونشويات', portionLabel: 'كوب (195 جم)', gramsPerPortion: 195, calories: 216, proteinG: 5, carbsG: 45, fatG: 1.8, fiberG: 3.5, isPreWorkout: true, isVegetarian: true },
  { nameAr: 'عيش بلدي (خبز أسمر)', nameEn: 'Balady Bread', category: 'حبوب ونشويات', portionLabel: 'رغيف (100 جم)', gramsPerPortion: 100, calories: 265, proteinG: 9, carbsG: 55, fatG: 1.5, fiberG: 5, sodiumMg: 550, hasGluten: true, isPreWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'خبز توست أبيض', nameEn: 'White Toast', category: 'حبوب ونشويات', portionLabel: 'شريحة (28 جم)', gramsPerPortion: 28, calories: 73, proteinG: 2.3, carbsG: 13.5, fatG: 0.9, sodiumMg: 145, hasGluten: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'شوفان مطبوخ', nameEn: 'Cooked Oatmeal', category: 'حبوب ونشويات', portionLabel: 'كوب (234 جم)', gramsPerPortion: 234, calories: 158, proteinG: 6.2, carbsG: 27, fatG: 3.2, fiberG: 4, hasGluten: true, isPreWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'بطاطس مسلوقة', nameEn: 'Boiled Potato', category: 'حبوب ونشويات', portionLabel: 'حبة متوسطة (150 جم)', gramsPerPortion: 150, calories: 130, proteinG: 3, carbsG: 30, fatG: 0.2, fiberG: 3, isPreWorkout: true, isVegetarian: true, isCommon: true },
  { nameAr: 'معكرونة مطبوخة', nameEn: 'Cooked Pasta', category: 'حبوب ونشويات', portionLabel: 'كوب (140 جم)', gramsPerPortion: 140, calories: 220, proteinG: 8, carbsG: 43, fatG: 1.3, sodiumMg: 1, hasGluten: true, isPreWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'بطاطا (يام حلوة)', nameEn: 'Sweet Potato', category: 'حبوب ونشويات', portionLabel: 'حبة متوسطة (130 جم)', gramsPerPortion: 130, calories: 112, proteinG: 2, carbsG: 26, fatG: 0.1, fiberG: 3.9, isPreWorkout: true, isVegetarian: true },
  { nameAr: 'كورن فليكس (ذرة محمصة)', nameEn: 'Cornflakes', category: 'حبوب ونشويات', portionLabel: 'كوب (30 جم)', gramsPerPortion: 30, calories: 110, proteinG: 2, carbsG: 25, fatG: 0.1, sugarsG: 3, sodiumMg: 200, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'بلح', nameEn: 'Dates', category: 'حبوب ونشويات', portionLabel: '3 حبات (24 جم)', gramsPerPortion: 24, calories: 66, proteinG: 0.5, carbsG: 18, fatG: 0.1, fiberG: 1.6, sugarsG: 16, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },

  // ---- خضروات ----
  { nameAr: 'خيار', nameEn: 'Cucumber', category: 'خضروات', portionLabel: 'ثمرة (100 جم)', gramsPerPortion: 100, calories: 15, proteinG: 0.7, carbsG: 3.6, fatG: 0.1, fiberG: 0.5, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'طماطم', nameEn: 'Tomato', category: 'خضروات', portionLabel: 'ثمرة (120 جم)', gramsPerPortion: 120, calories: 22, proteinG: 1, carbsG: 5, fatG: 0.2, fiberG: 1.5, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'خس', nameEn: 'Lettuce', category: 'خضروات', portionLabel: 'كوب (50 جم)', gramsPerPortion: 50, calories: 7, proteinG: 0.6, carbsG: 1.4, fatG: 0.1, fiberG: 0.6, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'جزر', nameEn: 'Carrot', category: 'خضروات', portionLabel: 'حبة (70 جم)', gramsPerPortion: 70, calories: 29, proteinG: 0.7, carbsG: 7, fatG: 0.1, fiberG: 2, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'بروكلي مطبوخ', nameEn: 'Cooked Broccoli', category: 'خضروات', portionLabel: 'كوب (156 جم)', gramsPerPortion: 156, calories: 55, proteinG: 3.7, carbsG: 11, fatG: 0.6, fiberG: 5, isVegetarian: true },
  { nameAr: 'سبانخ', nameEn: 'Spinach', category: 'خضروات', portionLabel: 'كوب (30 جم)', gramsPerPortion: 30, calories: 7, proteinG: 0.9, carbsG: 1.1, fatG: 0.1, fiberG: 0.7, isVegetarian: true, isCommon: true },
  { nameAr: 'كوسة', nameEn: 'Zucchini', category: 'خضروات', portionLabel: 'حبة (180 جم)', gramsPerPortion: 180, calories: 30, proteinG: 2.2, carbsG: 6.4, fatG: 0.4, fiberG: 2.3, isVegetarian: true, isCommon: true },
  { nameAr: 'فلفل ألوان', nameEn: 'Bell Pepper', category: 'خضروات', portionLabel: 'ثمرة (120 جم)', gramsPerPortion: 120, calories: 26, proteinG: 1.2, carbsG: 6, fatG: 0.2, fiberG: 2.4, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'باذنجان مشوي', nameEn: 'Grilled Eggplant', category: 'خضروات', portionLabel: 'نصف ثمرة (150 جم)', gramsPerPortion: 150, calories: 40, proteinG: 1.5, carbsG: 9, fatG: 0.3, fiberG: 4.5, isVegetarian: true },

  // ---- فواكه ----
  { nameAr: 'تفاح', nameEn: 'Apple', category: 'فواكه', portionLabel: 'ثمرة (180 جم)', gramsPerPortion: 180, calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, fiberG: 4.4, sugarsG: 19, isPreWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'موز', nameEn: 'Banana', category: 'فواكه', portionLabel: 'ثمرة (120 جم)', gramsPerPortion: 120, calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fiberG: 3.1, sugarsG: 14, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'برتقال', nameEn: 'Orange', category: 'فواكه', portionLabel: 'ثمرة (140 جم)', gramsPerPortion: 140, calories: 65, proteinG: 1.3, carbsG: 16, fatG: 0.2, fiberG: 3.4, sugarsG: 13, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'عنب', nameEn: 'Grapes', category: 'فواكه', portionLabel: 'كوب (150 جم)', gramsPerPortion: 150, calories: 104, proteinG: 1.1, carbsG: 27, fatG: 0.2, fiberG: 1.4, sugarsG: 23, isPreWorkout: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'فراولة', nameEn: 'Strawberries', category: 'فواكه', portionLabel: 'كوب (150 جم)', gramsPerPortion: 150, calories: 49, proteinG: 1, carbsG: 12, fatG: 0.5, fiberG: 3, sugarsG: 7, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'مانجو', nameEn: 'Mango', category: 'فواكه', portionLabel: 'ثمرة (200 جم)', gramsPerPortion: 200, calories: 120, proteinG: 1.7, carbsG: 30, fatG: 0.6, fiberG: 3, sugarsG: 26, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'بطيخ', nameEn: 'Watermelon', category: 'فواكه', portionLabel: 'شريحة (280 جم)', gramsPerPortion: 280, calories: 85, proteinG: 1.7, carbsG: 21, fatG: 0.4, fiberG: 1.1, sugarsG: 17, isCompetition: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'برتقال/ليمون عصير طازج', nameEn: 'Fresh Orange Juice', category: 'فواكه', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 110, proteinG: 1.7, carbsG: 25, fatG: 0.5, sugarsG: 21, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true },

  // ---- مكسرات وبذور ----
  { nameAr: 'لوز', nameEn: 'Almonds', category: 'مكسرات وبذور', portionLabel: 'حفنة (30 جم)', gramsPerPortion: 30, calories: 174, proteinG: 6.4, carbsG: 6, fatG: 15, fiberG: 3.5, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'جوز عين الجمل', nameEn: 'Walnuts', category: 'مكسرات وبذور', portionLabel: 'حفنة (28 جم)', gramsPerPortion: 28, calories: 185, proteinG: 4.3, carbsG: 3.9, fatG: 18.5, fiberG: 1.9, isVegetarian: true },
  { nameAr: 'زبدة الفول السوداني', nameEn: 'Peanut Butter', category: 'مكسرات وبذور', portionLabel: 'ملعقة (32 جم)', gramsPerPortion: 32, calories: 190, proteinG: 8, carbsG: 7, fatG: 16, fiberG: 2, sugarsG: 3, isPostWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'بذور الشيا', nameEn: 'Chia Seeds', category: 'مكسرات وبذور', portionLabel: 'ملعقتان (28 جم)', gramsPerPortion: 28, calories: 138, proteinG: 4.7, carbsG: 12, fatG: 8.7, fiberG: 9.8, isVegetarian: true },
  { nameAr: 'طحينة', nameEn: 'Tahini', category: 'مكسرات وبذور', portionLabel: 'ملعقة (15 جم)', gramsPerPortion: 15, calories: 89, proteinG: 2.6, carbsG: 3, fatG: 8, fiberG: 1.5, isVegetarian: true, isCommon: true },

  // ---- زيوت ودهون ----
  { nameAr: 'زيت زيتون', nameEn: 'Olive Oil', category: 'زيوت ودهون', portionLabel: 'ملعقة (14 جم)', gramsPerPortion: 14, calories: 119, proteinG: 0, carbsG: 0, fatG: 13.5, isVegetarian: true, isCommon: true },
  { nameAr: 'أفوكادو', nameEn: 'Avocado', category: 'زيوت ودهون', portionLabel: 'نصف ثمرة (100 جم)', gramsPerPortion: 100, calories: 160, proteinG: 2, carbsG: 9, fatG: 15, fiberG: 7, isVegetarian: true },

  // ---- مشروبات ----
  { nameAr: 'ماء', nameEn: 'Water', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'مشروب كربوهيدراتي رياضية (Isotonic)', nameEn: 'Sports Drink', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 60, proteinG: 0, carbsG: 15, fatG: 0, sugarsG: 15, sodiumMg: 120, isPreWorkout: false, isCompetition: true, isKidFriendly: false },
  { nameAr: 'عصير برتقال طبيعي', nameEn: 'Natural Orange Juice', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 110, proteinG: 1.7, carbsG: 25, fatG: 0.5, sugarsG: 21, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'عصير قصب سكر', nameEn: 'Sugar Cane Juice', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 240, proteinG: 0, carbsG: 60, fatG: 0, sugarsG: 58, isCompetition: false, isKidFriendly: false, isVegetarian: true, isCommon: true },
  { nameAr: 'قهوة عربية', nameEn: 'Arabic Coffee', category: 'مشروبات', portionLabel: 'فنجان (60 مل)', gramsPerPortion: 60, calories: 3, proteinG: 0.1, carbsG: 0.6, fatG: 0, isKidFriendly: false, isVegetarian: true },
  { nameAr: 'مشروب بروتين (حليب + موز)', nameEn: 'Protein Shake', category: 'مشروبات', portionLabel: 'كوب (350 مل)', gramsPerPortion: 350, calories: 300, proteinG: 30, carbsG: 35, fatG: 5, sugarsG: 25, sodiumMg: 250, hasLactose: true, isPostWorkout: true, isCompetition: false, isKidFriendly: false },

  // ---- وجبات عربية جاهزة ----
  { nameAr: 'كشري', nameEn: 'Koshary', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (350 جم)', gramsPerPortion: 350, calories: 450, proteinG: 16, carbsG: 75, fatG: 9, fiberG: 12, sodiumMg: 700, hasGluten: true, isVegetarian: true, isCommon: true },
  { nameAr: 'شوربة عدس', nameEn: 'Lentil Soup', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (250 جم)', gramsPerPortion: 250, calories: 190, proteinG: 11, carbsG: 30, fatG: 3, fiberG: 8, sodiumMg: 450, isVegetarian: true, isCommon: true },
  { nameAr: 'فول + خبز + زيت زيتون', nameEn: 'Fava with Bread', category: 'وجبات عربية جاهزة', portionLabel: 'وجبة (300 جم)', gramsPerPortion: 300, calories: 400, proteinG: 18, carbsG: 60, fatG: 10, fiberG: 14, sodiumMg: 700, hasGluten: true, isVegetarian: true, isCommon: true },
  { nameAr: 'ملوخية + أرز + دجاج', nameEn: 'Molokhia with Rice & Chicken', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (400 جم)', gramsPerPortion: 400, calories: 520, proteinG: 35, carbsG: 55, fatG: 18, sodiumMg: 600, isCommon: true },
  { nameAr: 'مسقعة باذنجان', nameEn: 'Moussaka', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (250 جم)', gramsPerPortion: 250, calories: 280, proteinG: 8, carbsG: 25, fatG: 16, fiberG: 7, sodiumMg: 500, isVegetarian: true },
  { nameAr: 'دجاج محشي رز', nameEn: 'Stuffed Chicken with Rice', category: 'وجبات عربية جاهزة', portionLabel: 'حصة (350 جم)', gramsPerPortion: 350, calories: 480, proteinG: 35, carbsG: 45, fatG: 16, sodiumMg: 650, isCommon: true },
  { nameAr: 'كبسة لحم', nameEn: 'Kabsa', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (400 جم)', gramsPerPortion: 400, calories: 620, proteinG: 35, carbsG: 60, fatG: 25, sodiumMg: 750, isCommon: true },
  { nameAr: 'فاصوليا خضراء بالأرز', nameEn: 'Green Beans with Rice', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (300 جم)', gramsPerPortion: 300, calories: 260, proteinG: 9, carbsG: 45, fatG: 6, fiberG: 8, sodiumMg: 400, isVegetarian: true },
  { nameAr: 'سمك مقلي + أرز + سلطة', nameEn: 'Fried Fish with Rice', category: 'وجبات عربية جاهزة', portionLabel: 'وجبة (400 جم)', gramsPerPortion: 400, calories: 650, proteinG: 35, carbsG: 55, fatG: 30, sodiumMg: 500, isCommon: true },
  { nameAr: 'ساندويتش فول وطحينة', nameEn: 'Falafel Sandwich', category: 'وجبات عربية جاهزة', portionLabel: 'ساندويتش (200 جم)', gramsPerPortion: 200, calories: 420, proteinG: 13, carbsG: 50, fatG: 19, fiberG: 6, sodiumMg: 600, hasGluten: true, isVegetarian: true, isCommon: true },
  { nameAr: 'ساندويتش جبنة', nameEn: 'Cheese Sandwich', category: 'وجبات عربية جاهزة', portionLabel: 'ساندويتش (120 جم)', gramsPerPortion: 120, calories: 280, proteinG: 12, carbsG: 28, fatG: 13, sodiumMg: 500, hasGluten: true, hasLactose: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'سلطة عربية (خضار + ليمون)', nameEn: 'Arabic Salad', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (150 جم)', gramsPerPortion: 150, calories: 45, proteinG: 1.5, carbsG: 9, fatG: 0.5, fiberG: 3, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'تابولي', nameEn: 'Tabbouleh', category: 'وجبات عربية جاهزة', portionLabel: 'كوب (100 جم)', gramsPerPortion: 100, calories: 90, proteinG: 2, carbsG: 12, fatG: 4, fiberG: 3, isVegetarian: true },

  // ---- وجبات خفيفة وحلويات ----
  { nameAr: 'تمر محشو لوز', nameEn: 'Dates with Almonds', category: 'وجبات خفيفة وحلويات', portionLabel: '3 حبات (35 جم)', gramsPerPortion: 35, calories: 110, proteinG: 1.5, carbsG: 24, fatG: 2, fiberG: 2.5, sugarsG: 18, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'مكسرات مشكلة', nameEn: 'Mixed Nuts', category: 'وجبات خفيفة وحلويات', portionLabel: 'حفنة (30 جم)', gramsPerPortion: 30, calories: 180, proteinG: 6, carbsG: 7, fatG: 16, fiberG: 3, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'زبادي بالفواكه', nameEn: 'Fruit Yogurt', category: 'وجبات خفيفة وحلويات', portionLabel: 'عبوة (150 جم)', gramsPerPortion: 150, calories: 150, proteinG: 6, carbsG: 25, fatG: 3, sugarsG: 20, hasLactose: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'حلاوة طحينية', nameEn: 'Tahini Halva', category: 'وجبات خفيفة وحلويات', portionLabel: 'قطعة (40 جم)', gramsPerPortion: 40, calories: 200, proteinG: 4, carbsG: 22, fatG: 11, sugarsG: 15, isVegetarian: true, isCommon: true },
  { nameAr: 'بسكويت شوفان', nameEn: 'Oat Cookies', category: 'وجبات خفيفة وحلويات', portionLabel: 'قطعتان (30 جم)', gramsPerPortion: 30, calories: 140, proteinG: 3, carbsG: 20, fatG: 6, sugarsG: 8, hasGluten: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'بشار (فشار) بدون زيت', nameEn: 'Popcorn', category: 'وجبات خفيفة وحلويات', portionLabel: 'كوب (8 جم)', gramsPerPortion: 8, calories: 31, proteinG: 1, carbsG: 6, fatG: 0.4, fiberG: 1.2, isVegetarian: true, isKidFriendly: true },
  { nameAr: 'شوكولاتة داكنة 70%', nameEn: 'Dark Chocolate 70%', category: 'وجبات خفيفة وحلويات', portionLabel: 'مربعان (20 جم)', gramsPerPortion: 20, calories: 120, proteinG: 1.5, carbsG: 9, fatG: 9, fiberG: 2, sugarsG: 6, isVegetarian: true },
];
