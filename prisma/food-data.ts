/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
prisma/food-data.ts

وظيفة الملف:
قاعدة بيانات الأطعمة (مصدر بيانات ثابت داخل الكود).
يحتوي على قائمتين كبيرتين:
- CATEGORIES: تصنيفات الطعام (فواكه، بروتينات...).
- FOODS: ~76 صنفًا عربيًا شائعًا بقيمها الغذائية
  (سعرات، بروتين، كربوهيدرات، دهون...) لكل 100 جرام
  أو بحجم الحصة المذكور، بناءً على مراجع موثوقة (USDA).

لماذا نحتاجه؟
المشروع لا يملك قاعدة أطعمة خارجية — هذه البيانات هي مصدر
الأطعمة الذي تستخدمه الحاسبة ومولّد الخطط الغذائية وقوائم
البدائل والبحث.

متى يعمل؟
لا "يعمل" من تلقاء نفسه — إنه ملف بيانات. يُستورد من:
- prisma/seed.ts (لحشو قاعدة البيانات)
- scripts/sync-foods.ts (لمزامنة الإنتاج)
- خدمات التغذية والخطط (للبحث في الأطعمة)

الملفات التي يتعامل معها:
- prisma/seed.ts و scripts/sync-foods.ts (يستهلكانه)
- src/services/* (يقرأون منه عبر قاعدة البيانات بعد حشوها)
==================================================
*/

/**
 * قاعدة بيانات الطعام — أطعمة عربية شائعة بقيم غذائية مبنية على
 * مراجع قياسية موثوقة (USDA FoodData Central / قواعد بيانات مغذية عربية معتمدة).
 * القيم لكل 100 جرام أو بحجم الحصة المذكور. تُستكمل لاحقًا عبر استيراد APIs.
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
  { nameAr: 'ورك دجاج مشوي (بدون جلد)', nameEn: 'Roasted Chicken Thigh', category: 'لحوم ودواجن وأسماك', portionLabel: 'قطعة (85 جم)', gramsPerPortion: 85, calories: 178, proteinG: 22.2, carbsG: 0, fatG: 9.3, sodiumMg: 74, isPostWorkout: true },
  { nameAr: 'ساق دجاج مشوي (بدون جلد)', nameEn: 'Roasted Chicken Drumstick', category: 'لحوم ودواجن وأسماك', portionLabel: 'ساق (90 جم)', gramsPerPortion: 90, calories: 166, proteinG: 23.2, carbsG: 0, fatG: 7.5, sodiumMg: 80, isPostWorkout: true },
  { nameAr: 'تونة بالماء', nameEn: 'Tuna in Water', category: 'لحوم ودواجن وأسماك', portionLabel: 'علبة صغيرة (100 جم)', gramsPerPortion: 100, calories: 116, proteinG: 25.5, carbsG: 0, fatG: 0.8, sodiumMg: 247, isPostWorkout: true },
  { nameAr: 'جمبري مشوي', nameEn: 'Grilled Shrimp', category: 'لحوم ودواجن وأسماك', portionLabel: 'حصة (100 جم)', gramsPerPortion: 100, calories: 99, proteinG: 24, carbsG: 0.2, fatG: 0.3, sodiumMg: 111, isPostWorkout: true },
  { nameAr: 'سردين بالزيت', nameEn: 'Sardines in Oil', category: 'لحوم ودواجن وأسماك', portionLabel: 'علبة (100 جم)', gramsPerPortion: 100, calories: 208, proteinG: 24.6, carbsG: 0, fatG: 11.5, sodiumMg: 505, isPostWorkout: true },
  { nameAr: 'شريحة لحم بقري مشوية', nameEn: 'Grilled Beef Sirloin Steak', category: 'لحوم ودواجن وأسماك', portionLabel: 'شريحة (150 جم)', gramsPerPortion: 150, calories: 309, proteinG: 43.5, carbsG: 0, fatG: 14, sodiumMg: 90, isPostWorkout: true },
  { nameAr: 'كبدة بقري مطبوخة', nameEn: 'Cooked Beef Liver', category: 'لحوم ودواجن وأسماك', portionLabel: 'قطعة (100 جم)', gramsPerPortion: 100, calories: 175, proteinG: 26, carbsG: 5.1, fatG: 5.3, sodiumMg: 69, isPostWorkout: true },

  // ---- ألبان وبيض ----
  { nameAr: 'بيضة مسلوقة', nameEn: 'Boiled Egg', category: 'ألبان وبيض', portionLabel: 'بيضة (50 جم)', gramsPerPortion: 50, calories: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3, sodiumMg: 62, isPreWorkout: false, isPostWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'زبادي يوناني', nameEn: 'Greek Yogurt', category: 'ألبان وبيض', portionLabel: 'عبوة (170 جم)', gramsPerPortion: 170, calories: 130, proteinG: 16, carbsG: 7, fatG: 4, sugarsG: 6, sodiumMg: 65, hasLactose: true, isPostWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'حليب كامل الدسم', nameEn: 'Whole Milk', category: 'ألبان وبيض', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 146, proteinG: 7.9, carbsG: 11.5, fatG: 7.9, sugarsG: 11.5, sodiumMg: 110, hasLactose: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'حليب منزوع الدسم', nameEn: 'Skim Milk', category: 'ألبان وبيض', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 83, proteinG: 8.3, carbsG: 12.5, fatG: 0.2, sugarsG: 12.5, sodiumMg: 125, hasLactose: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'جبنة قريش', nameEn: 'Cottage Cheese', category: 'ألبان وبيض', portionLabel: 'كوب (150 جم)', gramsPerPortion: 150, calories: 147, proteinG: 20, carbsG: 5, fatG: 5, sodiumMg: 500, hasLactose: true, isPostWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'جبنة شيدر', nameEn: 'Cheddar Cheese', category: 'ألبان وبيض', portionLabel: 'شريحة (28 جم)', gramsPerPortion: 28, calories: 113, proteinG: 7, carbsG: 0.9, fatG: 9.3, sodiumMg: 174, hasLactose: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'بياض بيضة', nameEn: 'Egg White', category: 'ألبان وبيض', portionLabel: 'بياض بيضتين (66 جم)', gramsPerPortion: 66, calories: 34, proteinG: 7.2, carbsG: 0.5, fatG: 0.1, sodiumMg: 111, isVegetarian: true, isPostWorkout: true },
  { nameAr: 'زبادي كامل الدسم', nameEn: 'Plain Whole Milk Yogurt', category: 'ألبان وبيض', portionLabel: 'عبوة (170 جم)', gramsPerPortion: 170, calories: 104, proteinG: 5.9, carbsG: 7.9, fatG: 5.5, sugarsG: 7.5, sodiumMg: 96, hasLactose: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'حليب قليل الدسم 1%', nameEn: 'Low-Fat Milk 1%', category: 'ألبان وبيض', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 102, proteinG: 8.2, carbsG: 12.2, fatG: 2.4, sugarsG: 12.2, sodiumMg: 125, hasLactose: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'جبنة فيتا', nameEn: 'Feta Cheese', category: 'ألبان وبيض', portionLabel: 'قطعة (50 جم)', gramsPerPortion: 50, calories: 132, proteinG: 7.1, carbsG: 2, fatG: 10.7, sodiumMg: 458, hasLactose: true, isVegetarian: true },
  { nameAr: 'جبنة رومي', nameEn: 'Egyptian Rumi Cheese', category: 'ألبان وبيض', portionLabel: 'شريحة (40 جم)', gramsPerPortion: 40, calories: 128, proteinG: 9.6, carbsG: 0.6, fatG: 9.6, sodiumMg: 600, hasLactose: true, isVegetarian: true, isCommon: true },
  { nameAr: 'جبنة موزاريلا قليلة الدسم', nameEn: 'Part-Skim Mozzarella', category: 'ألبان وبيض', portionLabel: 'قطعة (50 جم)', gramsPerPortion: 50, calories: 140, proteinG: 14, carbsG: 1.5, fatG: 8.5, sodiumMg: 316, hasLactose: true, isVegetarian: true },

  // ---- بقوليات ----
  { nameAr: 'عدس مطبوخ', nameEn: 'Cooked Lentils', category: 'بقوليات', portionLabel: 'كوب (200 جم)', gramsPerPortion: 200, calories: 230, proteinG: 18, carbsG: 40, fatG: 0.8, fiberG: 16, isPostWorkout: false, isVegetarian: true, isCommon: true },
  { nameAr: 'حمص مسلوق', nameEn: 'Boiled Chickpeas', category: 'بقوليات', portionLabel: 'كوب (164 جم)', gramsPerPortion: 164, calories: 269, proteinG: 14.5, carbsG: 45, fatG: 4.3, fiberG: 12.5, isVegetarian: true, isCommon: true },
  { nameAr: 'فول مدمس', nameEn: 'Fava Beans', category: 'بقوليات', portionLabel: 'طبق (150 جم)', gramsPerPortion: 150, calories: 165, proteinG: 10, carbsG: 27, fatG: 2, fiberG: 8, isVegetarian: true, isCommon: true },
  { nameAr: 'فاصوليا بيضاء', nameEn: 'White Beans', category: 'بقوليات', portionLabel: 'كوب (180 جم)', gramsPerPortion: 180, calories: 230, proteinG: 15, carbsG: 41, fatG: 1, fiberG: 11, isVegetarian: true },
  { nameAr: 'فاصوليا حمراء مطبوخة', nameEn: 'Cooked Kidney Beans', category: 'بقوليات', portionLabel: 'كوب (177 جم)', gramsPerPortion: 177, calories: 225, proteinG: 15.3, carbsG: 40.4, fatG: 0.9, fiberG: 13.1, isVegetarian: true, isCommon: true },
  { nameAr: 'لوبيا مطبوخة', nameEn: 'Cooked Black-Eyed Peas', category: 'بقوليات', portionLabel: 'كوب (171 جم)', gramsPerPortion: 171, calories: 200, proteinG: 13.2, carbsG: 35.7, fatG: 0.9, fiberG: 11.1, isVegetarian: true },
  { nameAr: 'فول الصويا (إدامامي)', nameEn: 'Edamame', category: 'بقوليات', portionLabel: 'كوب (155 جم)', gramsPerPortion: 155, calories: 188, proteinG: 18.4, carbsG: 13.8, fatG: 8.1, fiberG: 8.1, isVegetarian: true },
  { nameAr: 'ترمس مسلوق', nameEn: 'Boiled Lupin', category: 'بقوليات', portionLabel: 'كوب (100 جم)', gramsPerPortion: 100, calories: 119, proteinG: 15.6, carbsG: 9.9, fatG: 2.9, fiberG: 4.8, isVegetarian: true, isCommon: true },
  { nameAr: 'بازلاء خضراء مطبوخة', nameEn: 'Cooked Green Peas', category: 'بقوليات', portionLabel: 'كوب (160 جم)', gramsPerPortion: 160, calories: 134, proteinG: 8.6, carbsG: 25, fatG: 0.4, fiberG: 8.8, isVegetarian: true, isCommon: true },

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
  { nameAr: 'كينوا مطبوخة', nameEn: 'Cooked Quinoa', category: 'حبوب ونشويات', portionLabel: 'كوب (185 جم)', gramsPerPortion: 185, calories: 222, proteinG: 8.1, carbsG: 39.4, fatG: 3.5, fiberG: 5.2, isPreWorkout: true, isVegetarian: true },
  { nameAr: 'برغل مطبوخ', nameEn: 'Cooked Bulgur', category: 'حبوب ونشويات', portionLabel: 'كوب (182 جم)', gramsPerPortion: 182, calories: 151, proteinG: 5.6, carbsG: 33.8, fatG: 0.4, fiberG: 8.2, hasGluten: true, isVegetarian: true, isCommon: true },
  { nameAr: 'عيش فينو', nameEn: 'White Pita Bread', category: 'حبوب ونشويات', portionLabel: 'رغيف (60 جم)', gramsPerPortion: 60, calories: 160, proteinG: 5.4, carbsG: 33, fatG: 1.1, sodiumMg: 340, hasGluten: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'ذرة مسلوقة', nameEn: 'Boiled Corn', category: 'حبوب ونشويات', portionLabel: 'كوز (100 جم)', gramsPerPortion: 100, calories: 96, proteinG: 3.4, carbsG: 21, fatG: 1.5, fiberG: 2.4, isPreWorkout: true, isVegetarian: true, isCommon: true },
  { nameAr: 'بطاطس مهروسة بالحليب', nameEn: 'Mashed Potato', category: 'حبوب ونشويات', portionLabel: 'كوب (245 جم)', gramsPerPortion: 245, calories: 237, proteinG: 4.4, carbsG: 35, fatG: 9.4, sodiumMg: 400, hasLactose: true, hasGluten: false, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'مكرونة قمح كامل مطبوخة', nameEn: 'Cooked Whole-Wheat Pasta', category: 'حبوب ونشويات', portionLabel: 'كوب (140 جم)', gramsPerPortion: 140, calories: 174, proteinG: 7.5, carbsG: 37, fatG: 0.8, fiberG: 6.3, hasGluten: true, isVegetarian: true },

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
  { nameAr: 'بامية مطبوخة', nameEn: 'Cooked Okra', category: 'خضروات', portionLabel: 'كوب (100 جم)', gramsPerPortion: 100, calories: 33, proteinG: 2, carbsG: 7.5, fatG: 0.2, fiberG: 3.2, isVegetarian: true, isCommon: true },
  { nameAr: 'قرنبيط مطبوخ', nameEn: 'Cooked Cauliflower', category: 'خضروات', portionLabel: 'كوب (100 جم)', gramsPerPortion: 100, calories: 23, proteinG: 1.8, carbsG: 4.1, fatG: 0.45, fiberG: 2.3, isVegetarian: true },
  { nameAr: 'كرنب مطبوخ', nameEn: 'Cooked Cabbage', category: 'خضروات', portionLabel: 'كوب (150 جم)', gramsPerPortion: 150, calories: 35, proteinG: 1.9, carbsG: 8.2, fatG: 0.9, fiberG: 4.3, isVegetarian: true, isCommon: true },
  { nameAr: 'شمندر مسلوق', nameEn: 'Boiled Beetroot', category: 'خضروات', portionLabel: 'ثمرة (100 جم)', gramsPerPortion: 100, calories: 44, proteinG: 1.7, carbsG: 10, fatG: 0.2, fiberG: 2, isVegetarian: true },
  { nameAr: 'جرجير', nameEn: 'Arugula', category: 'خضروات', portionLabel: 'كوب (20 جم)', gramsPerPortion: 20, calories: 5, proteinG: 0.5, carbsG: 0.7, fatG: 0.1, fiberG: 0.3, isVegetarian: true, isCommon: true },
  { nameAr: 'فطر مطبوخ', nameEn: 'Cooked Mushrooms', category: 'خضروات', portionLabel: 'كوب (100 جم)', gramsPerPortion: 100, calories: 28, proteinG: 2.2, carbsG: 5.3, fatG: 0.5, fiberG: 2.2, isVegetarian: true },
  { nameAr: 'بصل', nameEn: 'Onion', category: 'خضروات', portionLabel: 'ثمرة (100 جم)', gramsPerPortion: 100, calories: 40, proteinG: 1.1, carbsG: 9.3, fatG: 0.1, fiberG: 1.7, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'فلفل حار أحمر', nameEn: 'Red Hot Chili Pepper', category: 'خضروات', portionLabel: 'ثمرة (50 جم)', gramsPerPortion: 50, calories: 20, proteinG: 0.9, carbsG: 4.4, fatG: 0.2, fiberG: 0.8, isVegetarian: true },
  { nameAr: 'قلقاس', nameEn: 'Taro Root', category: 'خضروات', portionLabel: 'كوب (150 جم)', gramsPerPortion: 150, calories: 168, proteinG: 2.3, carbsG: 39.8, fatG: 0.3, fiberG: 6.2, isVegetarian: true, isCommon: true },

  // ---- فواكه ----
  { nameAr: 'تفاح', nameEn: 'Apple', category: 'فواكه', portionLabel: 'ثمرة (180 جم)', gramsPerPortion: 180, calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, fiberG: 4.4, sugarsG: 19, isPreWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'موز', nameEn: 'Banana', category: 'فواكه', portionLabel: 'ثمرة (120 جم)', gramsPerPortion: 120, calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fiberG: 3.1, sugarsG: 14, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'برتقال', nameEn: 'Orange', category: 'فواكه', portionLabel: 'ثمرة (140 جم)', gramsPerPortion: 140, calories: 65, proteinG: 1.3, carbsG: 16, fatG: 0.2, fiberG: 3.4, sugarsG: 13, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'عنب', nameEn: 'Grapes', category: 'فواكه', portionLabel: 'كوب (150 جم)', gramsPerPortion: 150, calories: 104, proteinG: 1.1, carbsG: 27, fatG: 0.2, fiberG: 1.4, sugarsG: 23, isPreWorkout: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'فراولة', nameEn: 'Strawberries', category: 'فواكه', portionLabel: 'كوب (150 جم)', gramsPerPortion: 150, calories: 49, proteinG: 1, carbsG: 12, fatG: 0.5, fiberG: 3, sugarsG: 7, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'مانجو', nameEn: 'Mango', category: 'فواكه', portionLabel: 'ثمرة (200 جم)', gramsPerPortion: 200, calories: 120, proteinG: 1.7, carbsG: 30, fatG: 0.6, fiberG: 3, sugarsG: 26, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'بطيخ', nameEn: 'Watermelon', category: 'فواكه', portionLabel: 'شريحة (280 جم)', gramsPerPortion: 280, calories: 85, proteinG: 1.7, carbsG: 21, fatG: 0.4, fiberG: 1.1, sugarsG: 17, isCompetition: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'برتقال/ليمون عصير طازج', nameEn: 'Fresh Orange Juice', category: 'فواكه', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 110, proteinG: 1.7, carbsG: 25, fatG: 0.5, sugarsG: 21, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'كيوي', nameEn: 'Kiwi', category: 'فواكه', portionLabel: 'ثمرة (100 جم)', gramsPerPortion: 100, calories: 61, proteinG: 1.1, carbsG: 15, fatG: 0.5, fiberG: 3, sugarsG: 9, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'جوافة', nameEn: 'Guava', category: 'فواكه', portionLabel: 'ثمرة (100 جم)', gramsPerPortion: 100, calories: 68, proteinG: 2.6, carbsG: 14.3, fatG: 1, fiberG: 5.4, sugarsG: 9, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'رمان', nameEn: 'Pomegranate', category: 'فواكه', portionLabel: 'ثمرة (150 جم)', gramsPerPortion: 150, calories: 125, proteinG: 2.5, carbsG: 28, fatG: 1.8, fiberG: 6, sugarsG: 20.6, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'أناناس', nameEn: 'Pineapple', category: 'فواكه', portionLabel: 'كوب (150 جم)', gramsPerPortion: 150, calories: 75, proteinG: 0.8, carbsG: 19.5, fatG: 0.2, fiberG: 2.1, sugarsG: 14.9, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'خوخ', nameEn: 'Peach', category: 'فواكه', portionLabel: 'ثمرة (150 جم)', gramsPerPortion: 150, calories: 59, proteinG: 1.4, carbsG: 14.3, fatG: 0.4, fiberG: 2.3, sugarsG: 12.5, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'مشمش', nameEn: 'Apricot', category: 'فواكه', portionLabel: '3 حبات (105 جم)', gramsPerPortion: 105, calories: 50, proteinG: 1.5, carbsG: 11.6, fatG: 0.4, fiberG: 2.1, sugarsG: 9.7, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'كمثرى', nameEn: 'Pear', category: 'فواكه', portionLabel: 'ثمرة (150 جم)', gramsPerPortion: 150, calories: 86, proteinG: 0.5, carbsG: 22.5, fatG: 0.1, fiberG: 4.7, sugarsG: 15, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'ليمون', nameEn: 'Lemon', category: 'فواكه', portionLabel: 'ثمرة (58 جم)', gramsPerPortion: 58, calories: 17, proteinG: 0.6, carbsG: 5.4, fatG: 0.2, fiberG: 1.6, sugarsG: 1.4, isKidFriendly: true, isVegetarian: true, isCommon: true },

  // ---- مكسرات وبذور ----
  { nameAr: 'لوز', nameEn: 'Almonds', category: 'مكسرات وبذور', portionLabel: 'حفنة (30 جم)', gramsPerPortion: 30, calories: 174, proteinG: 6.4, carbsG: 6, fatG: 15, fiberG: 3.5, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'جوز عين الجمل', nameEn: 'Walnuts', category: 'مكسرات وبذور', portionLabel: 'حفنة (28 جم)', gramsPerPortion: 28, calories: 185, proteinG: 4.3, carbsG: 3.9, fatG: 18.5, fiberG: 1.9, isVegetarian: true },
  { nameAr: 'زبدة الفول السوداني', nameEn: 'Peanut Butter', category: 'مكسرات وبذور', portionLabel: 'ملعقة (32 جم)', gramsPerPortion: 32, calories: 190, proteinG: 8, carbsG: 7, fatG: 16, fiberG: 2, sugarsG: 3, isPostWorkout: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'بذور الشيا', nameEn: 'Chia Seeds', category: 'مكسرات وبذور', portionLabel: 'ملعقتان (28 جم)', gramsPerPortion: 28, calories: 138, proteinG: 4.7, carbsG: 12, fatG: 8.7, fiberG: 9.8, isVegetarian: true },
  { nameAr: 'طحينة', nameEn: 'Tahini', category: 'مكسرات وبذور', portionLabel: 'ملعقة (15 جم)', gramsPerPortion: 15, calories: 89, proteinG: 2.6, carbsG: 3, fatG: 8, fiberG: 1.5, isVegetarian: true, isCommon: true },
  { nameAr: 'كاجو', nameEn: 'Cashews', category: 'مكسرات وبذور', portionLabel: 'حفنة (30 جم)', gramsPerPortion: 30, calories: 166, proteinG: 5.5, carbsG: 9, fatG: 13.2, fiberG: 1.3, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'فستق محمص', nameEn: 'Roasted Pistachios', category: 'مكسرات وبذور', portionLabel: 'حفنة (30 جم)', gramsPerPortion: 30, calories: 162, proteinG: 5.9, carbsG: 8, fatG: 13, fiberG: 3, isVegetarian: true },
  { nameAr: 'بذور عباد الشمس', nameEn: 'Sunflower Seeds', category: 'مكسرات وبذور', portionLabel: 'حفنة (30 جم)', gramsPerPortion: 30, calories: 175, proteinG: 6.2, carbsG: 6, fatG: 15, fiberG: 3, isVegetarian: true },
  { nameAr: 'بذور الكتان', nameEn: 'Flax Seeds', category: 'مكسرات وبذور', portionLabel: 'ملعقتان (30 جم)', gramsPerPortion: 30, calories: 160, proteinG: 5.5, carbsG: 8.6, fatG: 12.6, fiberG: 8.2, isVegetarian: true },
  { nameAr: 'زبيب', nameEn: 'Raisins', category: 'مكسرات وبذور', portionLabel: 'حفنة (28 جم)', gramsPerPortion: 28, calories: 85, proteinG: 1, carbsG: 22.4, fatG: 0.1, fiberG: 1, sugarsG: 20, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true },

  // ---- زيوت ودهون ----
  { nameAr: 'زيت زيتون', nameEn: 'Olive Oil', category: 'زيوت ودهون', portionLabel: 'ملعقة (14 جم)', gramsPerPortion: 14, calories: 119, proteinG: 0, carbsG: 0, fatG: 13.5, isVegetarian: true, isCommon: true },
  { nameAr: 'أفوكادو', nameEn: 'Avocado', category: 'زيوت ودهون', portionLabel: 'نصف ثمرة (100 جم)', gramsPerPortion: 100, calories: 160, proteinG: 2, carbsG: 9, fatG: 15, fiberG: 7, isVegetarian: true },
  { nameAr: 'زبدة', nameEn: 'Butter', category: 'زيوت ودهون', portionLabel: 'ملعقة (14 جم)', gramsPerPortion: 14, calories: 102, proteinG: 0.1, carbsG: 0, fatG: 11.5, hasLactose: true, isVegetarian: true },
  { nameAr: 'سمن بلدي', nameEn: 'Ghee', category: 'زيوت ودهون', portionLabel: 'ملعقة (14 جم)', gramsPerPortion: 14, calories: 126, proteinG: 0, carbsG: 0, fatG: 14, hasLactose: true, isVegetarian: true, isCommon: true },
  { nameAr: 'زيت عباد الشمس', nameEn: 'Sunflower Oil', category: 'زيوت ودهون', portionLabel: 'ملعقة (14 جم)', gramsPerPortion: 14, calories: 120, proteinG: 0, carbsG: 0, fatG: 13.6, isVegetarian: true, isCommon: true },
  { nameAr: 'مايونيز', nameEn: 'Mayonnaise', category: 'زيوت ودهون', portionLabel: 'ملعقة (14 جم)', gramsPerPortion: 14, calories: 94, proteinG: 0.1, carbsG: 0.4, fatG: 10.3, isVegetarian: true },

  // ---- مشروبات ----
  { nameAr: 'ماء', nameEn: 'Water', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'مشروب كربوهيدراتي رياضية (Isotonic)', nameEn: 'Sports Drink', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 60, proteinG: 0, carbsG: 15, fatG: 0, sugarsG: 15, sodiumMg: 120, isPreWorkout: false, isCompetition: true, isKidFriendly: false },
  { nameAr: 'عصير برتقال طبيعي', nameEn: 'Natural Orange Juice', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 110, proteinG: 1.7, carbsG: 25, fatG: 0.5, sugarsG: 21, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'عصير قصب سكر', nameEn: 'Sugar Cane Juice', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 240, proteinG: 0, carbsG: 60, fatG: 0, sugarsG: 58, isCompetition: false, isKidFriendly: false, isVegetarian: true, isCommon: true },
  { nameAr: 'قهوة عربية', nameEn: 'Arabic Coffee', category: 'مشروبات', portionLabel: 'فنجان (60 مل)', gramsPerPortion: 60, calories: 3, proteinG: 0.1, carbsG: 0.6, fatG: 0, isKidFriendly: false, isVegetarian: true },
  { nameAr: 'مشروب بروتين (حليب + موز)', nameEn: 'Protein Shake', category: 'مشروبات', portionLabel: 'كوب (350 مل)', gramsPerPortion: 350, calories: 300, proteinG: 30, carbsG: 35, fatG: 5, sugarsG: 25, sodiumMg: 250, hasLactose: true, isPostWorkout: true, isCompetition: false, isKidFriendly: false },
  { nameAr: 'شاي سادة (بدون سكر)', nameEn: 'Plain Tea', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 2, proteinG: 0, carbsG: 0.5, fatG: 0, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'شاي بالنعناع', nameEn: 'Mint Tea', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 4, proteinG: 0, carbsG: 1, fatG: 0, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'قهوة سريعة التحضير (نسكافيه)', nameEn: 'Instant Coffee', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 4, proteinG: 0.3, carbsG: 0.7, fatG: 0, isKidFriendly: false, isVegetarian: true },
  { nameAr: 'عصير جوافة طبيعي', nameEn: 'Natural Guava Juice', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 130, proteinG: 1.4, carbsG: 30, fatG: 0.9, sugarsG: 25, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'ليمون بالنعناع (مثلج)', nameEn: 'Lemon Mint Drink', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 12, proteinG: 0.2, carbsG: 3, fatG: 0, sugarsG: 2, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'تمر هندي', nameEn: 'Tamarind Drink', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 120, proteinG: 0.2, carbsG: 31, fatG: 0.1, sugarsG: 28, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'خروب', nameEn: 'Carob Drink', category: 'مشروبات', portionLabel: 'كوب (240 مل)', gramsPerPortion: 240, calories: 90, proteinG: 1.2, carbsG: 23, fatG: 0.1, sugarsG: 20, isKidFriendly: true, isVegetarian: true, isCommon: true },

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
  { nameAr: 'محشي ورق عنب', nameEn: 'Stuffed Vine Leaves', category: 'وجبات عربية جاهزة', portionLabel: 'حصة (150 جم)', gramsPerPortion: 150, calories: 190, proteinG: 3.5, carbsG: 28, fatG: 7, fiberG: 3, sodiumMg: 420, hasGluten: true, isVegetarian: true, isCommon: true },
  { nameAr: 'محشي كوسة', nameEn: 'Stuffed Zucchini', category: 'وجبات عربية جاهزة', portionLabel: 'حصة (250 جم)', gramsPerPortion: 250, calories: 230, proteinG: 8, carbsG: 28, fatG: 9, fiberG: 4, sodiumMg: 380, isVegetarian: true, isCommon: true },
  { nameAr: 'طعمية (فلافل)', nameEn: 'Falafel', category: 'وجبات عربية جاهزة', portionLabel: '5 أقراص (100 جم)', gramsPerPortion: 100, calories: 333, proteinG: 13.3, carbsG: 31.8, fatG: 17.8, fiberG: 4.9, sodiumMg: 300, hasGluten: true, isVegetarian: true, isCommon: true },
  { nameAr: 'شاورما دجاج', nameEn: 'Chicken Shawarma', category: 'وجبات عربية جاهزة', portionLabel: 'حصة (150 جم)', gramsPerPortion: 150, calories: 350, proteinG: 32, carbsG: 18, fatG: 17, sodiumMg: 550, isCommon: true },
  { nameAr: 'مجدرة (عدس ورز)', nameEn: 'Mujaddara', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (250 جم)', gramsPerPortion: 250, calories: 320, proteinG: 12, carbsG: 55, fatG: 6, fiberG: 8, sodiumMg: 350, isVegetarian: true, isCommon: true },
  { nameAr: 'شوربة لسان عصفور', nameEn: 'Chicken Noodle Soup', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (250 مل)', gramsPerPortion: 250, calories: 140, proteinG: 4, carbsG: 22, fatG: 3, fiberG: 1, sodiumMg: 480, hasGluten: true, isKidFriendly: true },
  { nameAr: 'شوربة خضار', nameEn: 'Vegetable Soup', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (250 مل)', gramsPerPortion: 250, calories: 80, proteinG: 3, carbsG: 12, fatG: 2, fiberG: 4, sodiumMg: 350, isVegetarian: true, isKidFriendly: true },
  { nameAr: 'مكرونة بشاميل', nameEn: 'Macarona Bechamel', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (300 جم)', gramsPerPortion: 300, calories: 480, proteinG: 18, carbsG: 52, fatG: 22, sodiumMg: 620, hasGluten: true, hasLactose: true, isKidFriendly: true, isCommon: true },
  { nameAr: 'بطاطس محمرة بالفرن', nameEn: 'Oven-Baked Fries', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (100 جم)', gramsPerPortion: 100, calories: 280, proteinG: 4, carbsG: 34, fatG: 14, fiberG: 3, sodiumMg: 320, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'سلطة طحينة', nameEn: 'Tahini Salad', category: 'وجبات عربية جاهزة', portionLabel: 'ملعقتان (30 جم)', gramsPerPortion: 30, calories: 75, proteinG: 1.6, carbsG: 3.5, fatG: 6, isVegetarian: true, isCommon: true },
  { nameAr: 'بابا غنوج', nameEn: 'Baba Ganoush', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (100 جم)', gramsPerPortion: 100, calories: 78, proteinG: 1.5, carbsG: 7, fatG: 5.5, fiberG: 3, isVegetarian: true },
  { nameAr: 'حمص بالطحينة (سلطة)', nameEn: 'Hummus', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (100 جم)', gramsPerPortion: 100, calories: 166, proteinG: 7.9, carbsG: 14.3, fatG: 9.6, fiberG: 6, sodiumMg: 379, isVegetarian: true, isCommon: true },
  { nameAr: 'مقلوبة دجاج', nameEn: 'Chicken Maqluba', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (350 جم)', gramsPerPortion: 350, calories: 500, proteinG: 26, carbsG: 55, fatG: 20, sodiumMg: 520, isCommon: true },
  { nameAr: 'صينية محشي (كوسة وباذنجان ورق عنب)', nameEn: 'Mixed Stuffed Vegetables', category: 'وجبات عربية جاهزة', portionLabel: 'حصة (300 جم)', gramsPerPortion: 300, calories: 380, proteinG: 12, carbsG: 40, fatG: 19, fiberG: 6, sodiumMg: 480, isVegetarian: true, isCommon: true },
  { nameAr: 'شكشوكة', nameEn: 'Shakshuka', category: 'وجبات عربية جاهزة', portionLabel: 'طبق (200 جم)', gramsPerPortion: 200, calories: 250, proteinG: 14, carbsG: 12, fatG: 17, fiberG: 3, sodiumMg: 480, hasGluten: false, isVegetarian: true, isCommon: true },

  // ---- وجبات خفيفة وحلويات ----
  { nameAr: 'تمر محشو لوز', nameEn: 'Dates with Almonds', category: 'وجبات خفيفة وحلويات', portionLabel: '3 حبات (35 جم)', gramsPerPortion: 35, calories: 110, proteinG: 1.5, carbsG: 24, fatG: 2, fiberG: 2.5, sugarsG: 18, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'مكسرات مشكلة', nameEn: 'Mixed Nuts', category: 'وجبات خفيفة وحلويات', portionLabel: 'حفنة (30 جم)', gramsPerPortion: 30, calories: 180, proteinG: 6, carbsG: 7, fatG: 16, fiberG: 3, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'زبادي بالفواكه', nameEn: 'Fruit Yogurt', category: 'وجبات خفيفة وحلويات', portionLabel: 'عبوة (150 جم)', gramsPerPortion: 150, calories: 150, proteinG: 6, carbsG: 25, fatG: 3, sugarsG: 20, hasLactose: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'حلاوة طحينية', nameEn: 'Tahini Halva', category: 'وجبات خفيفة وحلويات', portionLabel: 'قطعة (40 جم)', gramsPerPortion: 40, calories: 200, proteinG: 4, carbsG: 22, fatG: 11, sugarsG: 15, isVegetarian: true, isCommon: true },
  { nameAr: 'بسكويت شوفان', nameEn: 'Oat Cookies', category: 'وجبات خفيفة وحلويات', portionLabel: 'قطعتان (30 جم)', gramsPerPortion: 30, calories: 140, proteinG: 3, carbsG: 20, fatG: 6, sugarsG: 8, hasGluten: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'بشار (فشار) بدون زيت', nameEn: 'Popcorn', category: 'وجبات خفيفة وحلويات', portionLabel: 'كوب (8 جم)', gramsPerPortion: 8, calories: 31, proteinG: 1, carbsG: 6, fatG: 0.4, fiberG: 1.2, isVegetarian: true, isKidFriendly: true },
  { nameAr: 'شوكولاتة داكنة 70%', nameEn: 'Dark Chocolate 70%', category: 'وجبات خفيفة وحلويات', portionLabel: 'مربعان (20 جم)', gramsPerPortion: 20, calories: 120, proteinG: 1.5, carbsG: 9, fatG: 9, fiberG: 2, sugarsG: 6, isVegetarian: true },
  { nameAr: 'عسل نحل', nameEn: 'Honey', category: 'وجبات خفيفة وحلويات', portionLabel: 'ملعقة (21 جم)', gramsPerPortion: 21, calories: 64, proteinG: 0.1, carbsG: 17.3, fatG: 0, sugarsG: 17.3, isPreWorkout: true, isCompetition: true, isKidFriendly: true, isVegetarian: true, isCommon: true },
  { nameAr: 'مربى فراولة', nameEn: 'Strawberry Jam', category: 'وجبات خفيفة وحلويات', portionLabel: 'ملعقة (20 جم)', gramsPerPortion: 20, calories: 50, proteinG: 0.1, carbsG: 13, fatG: 0, sugarsG: 12, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'بقلاوة', nameEn: 'Baklava', category: 'وجبات خفيفة وحلويات', portionLabel: 'قطعة (60 جم)', gramsPerPortion: 60, calories: 300, proteinG: 3.3, carbsG: 25, fatG: 20, fiberG: 1.5, sugarsG: 12, hasGluten: true, isVegetarian: true, isCommon: true },
  { nameAr: 'معمول بالتمر', nameEn: 'Maamoul with Dates', category: 'وجبات خفيفة وحلويات', portionLabel: 'قطعة (50 جم)', gramsPerPortion: 50, calories: 210, proteinG: 3.5, carbsG: 31, fatG: 8, fiberG: 2, sugarsG: 15, hasGluten: true, isVegetarian: true, isCommon: true },
  { nameAr: 'كعك العيد', nameEn: 'Eid Cookies', category: 'وجبات خفيفة وحلويات', portionLabel: 'قطعة (60 جم)', gramsPerPortion: 60, calories: 258, proteinG: 4.2, carbsG: 36, fatG: 10.8, fiberG: 1.5, sugarsG: 12, hasGluten: true, isVegetarian: true },
  { nameAr: 'آيس كريم فانيليا', nameEn: 'Vanilla Ice Cream', category: 'وجبات خفيفة وحلويات', portionLabel: 'كوب (100 جم)', gramsPerPortion: 100, calories: 207, proteinG: 3.5, carbsG: 24, fatG: 11, sugarsG: 21, hasLactose: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'شيبسي (رقائق بطاطس)', nameEn: 'Potato Chips', category: 'وجبات خفيفة وحلويات', portionLabel: 'كيس صغير (28 جم)', gramsPerPortion: 28, calories: 152, proteinG: 2, carbsG: 15, fatG: 10, fiberG: 1.2, sodiumMg: 170, hasGluten: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'شوكولاتة حليب', nameEn: 'Milk Chocolate', category: 'وجبات خفيفة وحلويات', portionLabel: 'شريط (40 جم)', gramsPerPortion: 40, calories: 214, proteinG: 3.1, carbsG: 23.6, fatG: 12, sugarsG: 20.8, hasLactose: true, isKidFriendly: true, isVegetarian: true },
  { nameAr: 'جيلي (جيلاتين محلى)', nameEn: 'Jelly', category: 'وجبات خفيفة وحلويات', portionLabel: 'كوب (100 جم)', gramsPerPortion: 100, calories: 62, proteinG: 1.2, carbsG: 14.1, fatG: 0, sugarsG: 13, isKidFriendly: true, isVegetarian: true },
];
