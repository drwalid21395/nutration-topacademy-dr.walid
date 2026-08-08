/**
 * المولد الذكي للخطط الغذائية.
 * يبني خططًا متنوعة (لا تكرار حرفي للأيام) مع مراعاة:
 * الحساسية، الأطعمة غير المرغوبة، النظام الغذائي (نباتي/خالٍ من اللاكتوز…)،
 * الميزانية، توفر الأطعمة، والأهداف.
 */

export interface PlanFood {
  id: string;
  nameAr: string;
  category: string;
  portionLabel: string;
  gramsPerPortion: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  isPreWorkout?: boolean;
  isPostWorkout?: boolean;
  isCompetition?: boolean;
  isKidFriendly?: boolean;
  isVegetarian?: boolean;
  hasLactose?: boolean;
  hasGluten?: boolean;
  isCommon?: boolean;
  allergens?: string;
}

export interface MealSlot {
  type: string; // mealType key
  title: string;
  timing: string;
  share: number; // من إجمالي السعرات
  slots: SlotSpec[];
}

export interface SlotSpec {
  category: string[];
  labels: string[]; // أسماء مرشحة (fallback)
  min?: number;
  max?: number;
  targetShare?: number; // من سعرات الوجبة
  grams?: number; // كمية ثابتة مرشحة
}

export interface PlanItem {
  foodNameAr: string;
  quantity: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface PlanMeal {
  dayNumber: number;
  mealType: string;
  title: string;
  timing: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  items: PlanItem[];
  alternatives: Record<string, PlanItem[]>;
  note?: string;
}

export interface GeneratedPlan {
  days: PlanMeal[][]; // days[dayIndex] = meals[]
  shoppingList: string[];
  mealPrepTips: string[];
  foodSafetyNotes: string[];
  totalsPerDay: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
}

export interface GeneratorOptions {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealsPerDay: number;
  durationDays: number;
  mealCalories?: Record<string, number>;
  goal?: string;
  allergies?: string;
  dislikedFoods?: string;
  dietType?: string;
  budgetLevel?: string;
  availableFoods?: string;
  isCompetition?: boolean;
  swimmerLevel?: string;
  foodDb: PlanFood[];
}

const MEAL_SCHEDULE: Record<string, { title: string; timing: string }> = {
  breakfast: { title: 'الفطور', timing: '8:00 صباحًا' },
  snack1: { title: 'وجبة خفيفة صباحية', timing: '10:30 صباحًا' },
  preWorkout: { title: 'وجبة ما قبل التمرين', timing: 'قبل التمرين بـ 2-3 ساعات' },
  lunch: { title: 'الغداء', timing: '2:00 ظهرًا' },
  duringWorkout: { title: 'أثناء التدريب الطويل', timing: 'خلال الجلسة' },
  postWorkout: { title: 'وجبة ما بعد التمرين', timing: 'خلال 30-60 دقيقة بعد التمرين' },
  dinner: { title: 'العشاء', timing: '8:00 مساءً' },
  snack2: { title: 'وجبة خفيفة مسائية', timing: '10:00 مساءً' },
  supper: { title: 'وجبة ما قبل النوم', timing: '11:00 مساءً' },
};

/** إرشادات تجهيز المكونات التي تحتاج إعدادًا خاصًا (تُضاف لطريقة تحضير الوجبة). */
const ITEM_PREP: Record<string, string> = {
  'بذور الشيا': 'تُنقع لا تُؤكل جافة: انقع ملعقتين كبيرتين في نصف كوب حليب أو لبن زبادي أو ماء ليلة كاملة (أو 30 دقيقة على الأقل) حتى تتماسك كبودنغ، ثم أضف التفاح المقطّع فوقها مع رشة قرفة.',
  'شوفان مطبوخ': 'اطبخ كوب شوفان مع كوبين حليب أو ماء على نار هادئة 5-7 دقائق حتى يتماسك، أو انقعه في الثلاجة ليلة كاملة (شوفان الليل).',
  'عدس مطبوخ': 'اشطف العدس واطبخه في ماء مع بهارات حتى ينضج، واعصر عليه ليمونًا.',
  'فول مدمس': 'سخّن الفول المدمس مع قليل من زيت الزيتون والكمون.',
  'أرز أبيض مطبوخ': 'اشطف الأرز واطبخه مع ماء بنسبة 1 إلى 1.5 حتى امتصاص الماء.',
  'أرز بني مطبوخ': 'يحتاج وقتًا أطول: اطبخه مع كوبين ماء لكل كوب أرز لمدة 30-40 دقيقة.',
  'معكرونة مطبوخة': 'اسلقها في ماء مغلي مملح حتى تنضج ثم صفّها.',
  'بطاطس مسلوقة': 'اسلقها بقشرها في ماء مغلي حتى تنضج، ثم قشّرها وتناولها.',
  'صدر دجاج مشوي': 'تبّله واشوِه أو اخبزه حتى ينضج تمامًا، ويُحفظ مطبوخًا في الثلاجة حتى 3 أيام.',
  'سمك مشوي': 'اشوِه مع زيت زيتون وليمون وبهارات حتى ينضج.',
  'لحم بقري قليل الدهن': 'اطبخه بالشوي أو الطبخ البطيء حتى ينضج وأزل الدهن الظاهر.',
  'بروكلي مطبوخ': 'اسلقه بالبخار أو في ماء مغلي 3-4 دقائق فقط ليحتفظ بقوامه.',
  'كوسة': 'اطبخها بالبخار أو سوتيه بقليل من الزيت.',
  'سلطة عربية': 'قطّع الخضار الطازجة وأضف عصرة ليمون وملعقة زيت زيتون.',
  'بيضة مسلوقة': 'اغلها في ماء مغلي 8-10 دقائق ثم قشّرها.',
  'عصير برتقال طبيعي': 'اعصر البرتقال الطازج واشربه فورًا بدون سكر مضاف.',
  'مشروب كربوهيدراتي رياضية': 'حضّره حسب التعليمات على العبوة واشربه رشفات خلال التدريب.',
  'تمر محشو لوز': 'افتح التمر وأزل النواة وضع مكانها لوزة.',
};

/** طريقة تحضير عامة لكل نوع وجبة (سطر واحد موجز). */
const MEAL_PREP: Record<string, string> = {
  breakfast: 'بروتين (بيض/زبادي/جبن قريش) + نشويات (عيش/شوفان) + فاكهة، مع كوب ماء.',
  snack1: 'وجبة خفيفة سريعة تُؤكل مباشرة، وإن احتوت بذور شيا فانقعها أولًا (انظر أدناه).',
  preWorkout: 'وجبة سريعة الهضم قبل التدريب بـ 2-3 ساعات لتجنّب ثقل المعدة.',
  lunch: 'بروتين مطبوخ + نشويات مطبوخة + خضار/سلطة، مع ملعقة زيت زيتون على السلطة.',
  duringWorkout: 'تُتناول رشفات خلال التدريبات الطويلة (60-75 دقيقة فأكثر).',
  postWorkout: 'نافذة الاستشفاء: تُؤكل خلال 30-60 دقيقة بعد التمرين (بروتين + كربوهيدرات سريعة).',
  dinner: 'وجبة متوازنة خفيفة (بروتين + خضار) قبل النوم بساعتين على الأقل.',
  snack2: 'وجبة مسائية خفيفة قبل النوم.',
  supper: 'وجبة قبل النوم: بروتين بطيء الهضم مثل الزبادي أو الجبن القريش.',
};

const DEFAULT_MEALS: string[] = [
  'breakfast',
  'snack1',
  'preWorkout',
  'lunch',
  'postWorkout',
  'dinner',
  'snack2',
];

const DEFAULT_SHARES: Record<string, number> = {
  breakfast: 0.25,
  snack1: 0.1,
  preWorkout: 0.15,
  lunch: 0.25,
  duringWorkout: 0.05,
  postWorkout: 0.15,
  dinner: 0.2,
  snack2: 0.1,
  supper: 0.08,
};

/** قوالب الوجبات: كل نوع وجبة له مكونات محددة */
export const MEAL_SLOTS: Record<string, SlotSpec[]> = {
  breakfast: [
    { category: ['ألبان وبيض', 'بقوليات'], labels: ['بيضة مسلوقة', 'زبادي يوناني', 'جبنة قريش', 'فول مدمس'], min: 1, max: 2 },
    { category: ['حبوب ونشويات'], labels: ['عيش بلدي', 'شوفان مطبوخ', 'خبز توست'], targetShare: 0.35 },
    { category: ['فواكه'], labels: ['موز', 'تفاح', 'برتقال'], targetShare: 0.2 },
    { category: ['مكسرات وبذور'], labels: ['لوز', 'زبدة الفول السوداني'], targetShare: 0.15 },
  ],
  snack1: [
    { category: ['فواكه'], labels: ['تفاح', 'برتقال', 'عنب'], targetShare: 0.6 },
    { category: ['مكسرات وبذور'], labels: ['لوز', 'بذور الشيا'], targetShare: 0.4 },
  ],
  preWorkout: [
    { category: ['حبوب ونشويات'], labels: ['أرز أبيض مطبوخ', 'بطاطس مسلوقة', 'موز', 'بلح'], targetShare: 0.55 },
    { category: ['ألبان وبيض', 'لحوم ودواجن وأسماك'], labels: ['زبادي يوناني', 'صدر دجاج مشوي'], targetShare: 0.25 },
    { category: ['فواكه'], labels: ['موز', 'عنب', 'بلح'], targetShare: 0.2 },
  ],
  lunch: [
    { category: ['لحوم ودواجن وأسماك', 'بقوليات'], labels: ['صدر دجاج مشوي', 'سمك مشوي', 'عدس مطبوخ', 'لحم بقري قليل الدهن'], min: 1, max: 1, targetShare: 0.35 },
    { category: ['حبوب ونشويات'], labels: ['أرز أبيض مطبوخ', 'أرز بني مطبوخ', 'معكرونة مطبوخة'], targetShare: 0.35 },
    { category: ['خضروات'], labels: ['سلطة عربية', 'بروكلي مطبوخ', 'كوسة'], targetShare: 0.15 },
    { category: ['زيوت ودهون'], labels: ['زيت زيتون'], targetShare: 0.1 },
  ],
  duringWorkout: [
    { category: ['مشروبات'], labels: ['مشروب كربوهيدراتي رياضية', 'عصير برتقال طبيعي'], targetShare: 0.6 },
    { category: ['فواكه'], labels: ['موز', 'تمر محشو لوز'], targetShare: 0.4 },
  ],
  postWorkout: [
    { category: ['ألبان وبيض', 'لحوم ودواجن وأسماك'], labels: ['زبادي يوناني', 'مشروب بروتين', 'صدر دجاج مشوي', 'جبنة قريش'], min: 1, max: 1, targetShare: 0.45 },
    { category: ['حبوب ونشويات', 'فواكه'], labels: ['موز', 'خبز توست', 'عصير برتقال طبيعي'], targetShare: 0.45 },
    { category: ['مكسرات وبذور'], labels: ['زبدة الفول السوداني'], targetShare: 0.1 },
  ],
  dinner: [
    { category: ['لحوم ودواجن وأسماك', 'بقوليات', 'ألبان وبيض'], labels: ['صدر دجاج مشوي', 'سمك مشوي', 'عدس مطبوخ', 'جبنة قريش'], min: 1, max: 1, targetShare: 0.35 },
    { category: ['خضروات'], labels: ['سلطة عربية', 'سبانخ', 'فلفل ألوان', 'باذنجان مشوي'], targetShare: 0.3 },
    { category: ['حبوب ونشويات'], labels: ['أرز أبيض مطبوخ', 'عيش بلدي', 'بطاطا'], targetShare: 0.2 },
    { category: ['زيوت ودهون'], labels: ['زيت زيتون', 'أفوكادو'], targetShare: 0.15 },
  ],
  snack2: [
    { category: ['ألبان وبيض', 'فواكه'], labels: ['زبادي يوناني', 'موز', 'تفاح'], targetShare: 0.6 },
    { category: ['مكسرات وبذور'], labels: ['لوز', 'جوز عين الجمل'], targetShare: 0.4 },
  ],
  supper: [
    { category: ['ألبان وبيض'], labels: ['زبادي يوناني', 'حليب منزوع الدسم'], targetShare: 0.6 },
    { category: ['مكسرات وبذور'], labels: ['بذور الشيا', 'لوز'], targetShare: 0.4 },
  ],
};

/** هل الطعام مناسب لنمط الحمية المختار */
function fitsDiet(food: PlanFood, opts: GeneratorOptions): boolean {
  const diet = opts.dietType;
  if (diet === 'vegetarian' && !food.isVegetarian) return false;
  if (diet === 'lactoseFree' && food.hasLactose) return false;
  if (diet === 'glutenFree' && food.hasGluten) return false;
  return true;
}

/** هل الطعام ضمن المستبعدات (حساسية/غير مرغوب) */
function isExcluded(food: PlanFood, opts: GeneratorOptions): boolean {
  const lowerName = food.nameAr.toLowerCase();
  const excluded =
    (opts.allergies ?? '').toLowerCase() + ' ' + (opts.dislikedFoods ?? '').toLowerCase();
  if (excluded.trim()) {
    const words = excluded.split(/[،,;\s]+/).filter(Boolean);
    for (const w of words) {
      if (lowerName.includes(w)) return true;
    }
  }
  if (food.allergens) {
    const allergens = (opts.allergies ?? '').toLowerCase();
    for (const a of food.allergens.split(/[،,]/)) {
      if (allergens.includes(a.trim().toLowerCase())) return true;
    }
  }
  return false;
}

const EXPENSIVE_FOODS = [
  'سلمون مشوي',
  'أفوكادو',
  'جوز عين الجمل',
  'بذور الشيا',
  'مانجو',
  'مشروب كربوهيدراتي رياضية',
  'مشروب بروتين',
];

function fitsBudget(food: PlanFood, opts: GeneratorOptions): boolean {
  if (opts.budgetLevel === 'low') {
    return !EXPENSIVE_FOODS.includes(food.nameAr);
  }
  return true;
}

function pick(
  pool: PlanFood[],
  label?: string,
  used = new Set<string>()
): PlanFood | undefined {
  let candidates = pool;
  if (label) {
    const match = pool.find((f) => f.nameAr === label);
    if (match) return match;
  }
  const notUsed = candidates.filter((f) => !used.has(f.nameAr));
  const source = notUsed.length > 0 ? notUsed : candidates;
  return source[Math.floor(Math.random() * source.length)];
}

export const ALTERNATIVE_LABELS: Record<string, string> = {
  economical: 'بديل اقتصادي',
  vegetarian: 'بديل نباتي',
  lactoseFree: 'بديل خالٍ من اللاكتوز',
  glutenFree: 'بديل خالٍ من الجلوتين',
};

/** توليد بدائل الوجبة (اقتصادي/نباتي/خالٍ من اللاكتوز/خالٍ من الجلوتين) */
export function generateMealAlternatives(
  opts: GeneratorOptions,
  slots: SlotSpec[],
  target: number,
  itemsCals = 0
): Record<string, PlanItem[]> {
  const alternatives: Record<string, PlanItem[]> = {};

  (Object.keys(ALTERNATIVE_LABELS) as (keyof typeof ALTERNATIVE_LABELS)[]).forEach((altKey) => {
    const altItems: PlanItem[] = [];
    for (const slot of slots) {
      let altPool = opts.foodDb.filter(
        (f) =>
          slot.category.includes(f.category) &&
          !isExcluded(f, opts) &&
          (altKey === 'economical'
            ? fitsBudget(f, opts)
            : altKey === 'vegetarian'
            ? f.isVegetarian
            : altKey === 'lactoseFree'
            ? !f.hasLactose
            : !f.hasGluten)
      );
      if (altPool.length === 0) continue;
      const food = pick(altPool, undefined);
      if (!food) continue;
      const altCals = (target - itemsCals) * (slot.targetShare ?? 0.3);
      const grams = scale(food, Math.max(40, altCals));
      const factor = grams / (food.gramsPerPortion || 100);
      altItems.push({
        foodNameAr: food.nameAr,
        quantity: `${grams} جم`,
        grams,
        calories: round5(food.calories * factor),
        proteinG: Math.round(food.proteinG * factor * 10) / 10,
        carbsG: Math.round(food.carbsG * factor * 10) / 10,
        fatG: Math.round(food.fatG * factor * 10) / 10,
      });
    }
    if (altItems.length > 0) alternatives[altKey] = altItems;
  });

  return alternatives;
}

function scale(food: PlanFood, targetCals: number): number {
  if (!food.gramsPerPortion || food.calories <= 0) return food.gramsPerPortion ?? 100;
  return Math.round((targetCals / food.calories) * food.gramsPerPortion);
}

function round5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function generatePlan(opts: GeneratorOptions): GeneratedPlan {
  const mealsPerDay = Math.min(8, Math.max(3, opts.mealsPerDay));
  const mealOrder = [...DEFAULT_MEALS];
  const mealTypes = mealOrder.slice(0, mealsPerDay);

  // ميزانية السعرات للوجبة الواحدة
  const mealCals: Record<string, number> = {};
  const baseCals = opts.calories;
  const totalShare = mealTypes.reduce((acc, t) => acc + (DEFAULT_SHARES[t] ?? 0.15), 0);
  mealTypes.forEach((t) => {
    mealCals[t] = Math.round(((baseCals * (DEFAULT_SHARES[t] ?? 0.15)) / totalShare) / 5) * 5;
  });

  // إصلاح المجموع ليطابق السعرات المستهدفة تقريبًا
  const sumCals = Object.values(mealCals).reduce((a, b) => a + b, 0);
  if (sumCals !== 0 && Math.abs(sumCals - baseCals) > 20) {
    const diff = baseCals - sumCals;
    const first = mealTypes[0];
    mealCals[first] = Math.max(150, mealCals[first] + diff);
  }

  const days: PlanMeal[][] = [];
  const usedGlobally = new Map<string, Set<string>>();

  for (let day = 1; day <= opts.durationDays; day++) {
    const dayMeals: PlanMeal[] = [];

    mealTypes.forEach((type) => {
      if (!usedGlobally.has(type)) usedGlobally.set(type, new Set());
      const usedInType = usedGlobally.get(type)!;

      const target = mealCals[type] ?? 250;
      const slots = MEAL_SLOTS[type] ?? [];
      const items: PlanItem[] = [];
      let itemsCals = 0;
      let itemsP = 0;
      let itemsC = 0;
      let itemsF = 0;

      slots.forEach((slot, idx) => {
        let pool = opts.foodDb.filter(
          (f) =>
            slot.category.includes(f.category) &&
            fitsDiet(f, opts) &&
            !isExcluded(f, opts) &&
            fitsBudget(f, opts)
        );

        if (opts.isCompetition) {
          const compPool = pool.filter((f) => f.isCompetition);
          if (compPool.length > 0) pool = compPool;
        }

        if (pool.length === 0) {
          pool = opts.foodDb.filter((f) => slot.category.includes(f.category));
        }

        const label = slot.labels[idx % slot.labels.length];
        const food = pick(pool, label, usedInType);
        if (!food) return;

        usedInType.add(food.nameAr);

        const slotTarget = (target - itemsCals) * (slot.targetShare ?? 0.3);
        const grams = slot.grams ?? scale(food, Math.max(40, slotTarget));
        const factor = grams / (food.gramsPerPortion || 100);
        const cals = round5(food.calories * factor);
        const p = Math.round(food.proteinG * factor * 10) / 10;
        const c = Math.round(food.carbsG * factor * 10) / 10;
        const f = Math.round(food.fatG * factor * 10) / 10;

        items.push({
          foodNameAr: food.nameAr,
          quantity: `${grams} جم (≈ ${food.portionLabel})`,
          grams,
          calories: cals,
          proteinG: p,
          carbsG: c,
          fatG: f,
        });
        itemsCals += cals;
        itemsP += p;
        itemsC += c;
        itemsF += f;
      });

      // البدائل
      const alternatives = generateMealAlternatives(opts, slots, target, itemsCals);

      const meta = MEAL_SCHEDULE[type] ?? { title: type, timing: '' };

      // طريقة التحضير والتجهيز: سطر عام لكل وجبة + إرشادات خاصة لكل مكوّن يحتاج إعدادًا
      const prepLines: string[] = [];
      const genericPrep = MEAL_PREP[type];
      if (genericPrep) prepLines.push(genericPrep);
      for (const it of items) {
        const itemPrep = ITEM_PREP[it.foodNameAr];
        if (itemPrep) prepLines.push(`• ${it.foodNameAr}: ${itemPrep}`);
      }
      const note = prepLines.length
        ? `طريقة التحضير والتجهيز:\n${prepLines.join('\n')}`
        : undefined;

      dayMeals.push({
        dayNumber: day,
        mealType: type,
        title: meta.title,
        timing: meta.timing,
        calories: Math.round(itemsCals),
        proteinG: Math.round(itemsP * 10) / 10,
        carbsG: Math.round(itemsC * 10) / 10,
        fatG: Math.round(itemsF * 10) / 10,
        items,
        alternatives,
        note,
      });
    });

    days.push(dayMeals);
  }

  // قائمة مشتريات أسبوعية
  const shopping = new Set<string>();
  days.slice(0, 7).forEach((dayMeals) => {
    dayMeals.forEach((m) => {
      m.items.forEach((it) => shopping.add(it.foodNameAr));
    });
  });

  return {
    days,
    shoppingList: Array.from(shopping),
    mealPrepTips: [
      'حضّر صدر الدجاج والبروتينات بكميات تكفي 2-3 أيام واحفظها في علب محكمة.',
      'اغسل الخضار وقطّعها مسبقًا لتسريع تحضير السلطات.',
      'حضّر الشوفان أو الأرز مسبقًا ووزّعه على حصص جاهزة.',
      'احمل وجبات خفيفة جاهزة (موز، تمر، مكسرات) معك للتدريب.',
    ],
    foodSafetyNotes: [
      'احفظ اللحوم والدواجن المطبوخة في الثلاجة (4°م أو أقل) واستهلكها خلال 3-4 أيام.',
      'لا تترك الطعام في درجة حرارة الغرفة أكثر من ساعتين.',
      'أعد تسخين الوجبات المجمدة حتى تصل لحرارة عالية قبل الأكل.',
      'افصل اللحوم النيئة عن المطبوخة لمنع التلوث المتبادل.',
    ],
    totalsPerDay: {
      calories: baseCals,
      proteinG: opts.proteinG,
      carbsG: opts.carbsG,
      fatG: opts.fatG,
    },
  };
}

/** توليد خطة استعداد ليوم البطولة (أو يوم واحد خاص) */
export function generateCompetitionDayPlan(opts: GeneratorOptions): GeneratedPlan {
  const opts2: GeneratorOptions = {
    ...opts,
    mealsPerDay: 5,
    isCompetition: true,
  };
  return generatePlan(opts2);
}
