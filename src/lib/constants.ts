/** العلامة التجارية الثابتة للنظام */

export const BRAND = {
  nameAr: 'أكاديمية توب',
  nameEn: 'Top Academy',
  nameEnFull: 'TOP ACADEMY',
  productName: 'Smart Swimmer Nutrition',
  productNameAr: 'الذكية لتغذية السباحين',
  doctor: 'د. وليد عبد الرحمن عبد الظاهر',
  doctorTitle: 'إعداد وإشراف',
  tagline: 'خطط تغذية ذكية مبنية على العلم لرفع أداء السباح',
  year: new Date().getFullYear(),
} as const;

export const ROLES = {
  athlete: 'سباح',
  guardian: 'ولي أمر',
  coach: 'مدرب',
  dietitian: 'اختصاصي تغذية',
  admin: 'مدير النظام',
} as const;

export type RoleKey = keyof typeof ROLES;

export const AGE_GROUPS = {
  child: 'طفل',
  junior: 'ناشئ',
  youth: 'شاب',
  adult: 'بالغ',
} as const;

export const SWIMMER_LEVELS = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
  competitor: 'منافس',
  professional: 'بطل محترف',
} as const;

export const SPECIALTIES = {
  freestyle: 'حرة',
  backstroke: 'ظهر',
  breaststroke: 'صدر',
  butterfly: 'فراشة',
  medley: 'متنوع',
} as const;

export const INTENSITY = {
  low: 'منخفضة',
  moderate: 'متوسطة',
  high: 'مرتفعة',
  veryHigh: 'مرتفعة جدًا',
} as const;

export const GYM_TYPES = {
  resistance: 'مقاومة',
  strength: 'قوة',
  endurance: 'تحمل',
  flexibility: 'مرونة',
  speed: 'سرعة',
  mixed: 'تمارين مختلطة',
} as const;

export const GOALS = {
  maintenance: 'الحفاظ على الوزن',
  fatLoss: 'خفض الدهون',
  muscleGain: 'زيادة الكتلة العضلية',
  endurance: 'رفع التحمل',
  recovery: 'تحسين الاستشفاء',
  competition: 'الاستعداد للبطولة',
  weightGain: 'زيادة الوزن بصورة صحية',
} as const;

export const DIET_TYPES = {
  regular: 'نظام عادي',
  vegetarian: 'نباتي',
  semiVegetarian: 'نباتي جزئي',
  glutenFree: 'خالٍ من الجلوتين',
  lactoseFree: 'خالٍ من اللاكتوز',
} as const;

export const ACTIVITY_LEVELS = {
  sedentary: 'قليل جدًا',
  light: 'خفيف',
  moderate: 'متوسط',
  veryActive: 'نشط جدًا',
} as const;

export const PLAN_TYPES = {
  daily: 'خطة يوم واحد',
  threeDays: 'خطة 3 أيام',
  week: 'خطة أسبوع',
  twoWeeks: 'خطة أسبوعين',
  thirtyDays: 'خطة 30 يومًا',
  competitionPrep: 'خطة استعداد للبطولة',
  competitionDay: 'خطة يوم البطولة',
  postCompetition: 'خطة استشفاء بعد البطولة',
} as const;

export const MEAL_TYPES = {
  breakfast: 'الفطور',
  snack1: 'وجبة خفيفة صباحية',
  preWorkout: 'قبل التمرين',
  lunch: 'الغداء',
  duringWorkout: 'أثناء التمرين',
  postWorkout: 'بعد التمرين',
  dinner: 'العشاء',
  snack2: 'وجبة خفيفة مسائية',
  supper: 'وجبة قبل النوم',
} as const;

export type MealTypeKey = keyof typeof MEAL_TYPES;

export const MEAL_TYPE_ORDER: MealTypeKey[] = [
  'breakfast',
  'snack1',
  'preWorkout',
  'lunch',
  'duringWorkout',
  'postWorkout',
  'dinner',
  'snack2',
  'supper',
];

export const MEDICAL_DISCLAIMER =
  'الخطط والتوصيات المعروضة إرشادية وتقديرية لأغراض تعليمية عامة، ولا تُغني عن استشارة الطبيب أو اختصاصي التغذية الرياضية المعتمد، خصوصًا في حالات الأمراض المزمنة أو الحساسية الشديدة أو الرياضيين القاصرين. لا يقدّم النظام أي توصيات علاجية أو جرعات دوائية، وليس أداة تشخيص أو علاج.';

export const SUPPLEMENT_DISCLAIMER =
  'هذه الحاسبة أداة معلوماتية وتقديرية للمساعدة في مراجعة بيانات المكمل ومكوناته ومدى توافقه المبدئي مع البيانات المدخلة للسباح. النتائج لا تُعد تشخيصًا طبيًا، أو وصفة علاجية، أو توصية نهائية باستخدام أي مكمل غذائي، ولا تضمن سلامة المنتج أو أصالته أو خلوه من المواد المحظورة أو الملوثات. تختلف الاحتياجات والاستجابة من شخص إلى آخر، وقد تتأثر بالعمر والحالة الصحية والأدوية والتحاليل والنظام الغذائي وحجم التدريب. يجب عدم بدء أي مكمل أو تغيير كميته أو إيقافه بناءً على نتيجة الحاسبة وحدها. يلزم مراجعة الطبيب أو اختصاصي التغذية الرياضية المؤهل قبل الاستخدام، خصوصًا للأطفال والمراهقين والحوامل والمرضعات وأصحاب الأمراض المزمنة ومستخدمي الأدوية والسباحين المشاركين في البطولات. يتحمل المستخدم مسؤولية التحقق من المنتج ومصدره والالتزام بتعليمات الطبيب والجهات الرياضية المختصة.';

export const SUPPLEMENT_ACK_TEXT =
  'أقر بأن البيانات التي أدخلتها عن السباح والمكمل صحيحة قدر الإمكان، وأن نتائج الحاسبة تقديرية وتعتمد على البيانات المتاحة، ولا تمثل وصفة طبية أو تشخيصًا أو ضمانًا لسلامة المنتج أو أصالته أو خلوه من المواد المحظورة.';

export const SUPPLEMENT_BRANDING = 'إعداد وإشراف: د. وليد عبد الرحمن عبد الظاهر — Top Academy';

export const FOOD_DB_SIZE = 'قاعدة بيانات غذائية عربية (140+ صنفًا) بقيم غذائية مبنية على مراجع موثوقة (USDA FoodData Central وقواعد بيانات مغذية عربية معتمدة) — تُستكمل لاحقًا عبر API';
