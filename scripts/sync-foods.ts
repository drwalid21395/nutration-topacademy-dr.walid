/**
 * مزامنة قاعدة الأطعمة والتصنيفات فقط (جدولان مرجعيان عامان)
 * دون لمس بيانات المستخدمين أو الخطط أو السجلات.
 * الاستخدام بعد التبديل لـ schema PostgreSQL:
 *   DATABASE_URL=<neon> node --env-file? لا — يُقرأ من متغير البيئة.
 */
import { prisma } from '../src/lib/prisma';
import { CATEGORIES, FOODS } from '../prisma/food-data';

async function main() {
  console.log('🌱 مزامنة قاعدة الأطعمة…');

  await prisma.foodItem.deleteMany();
  await prisma.foodCategory.deleteMany();

  for (const cat of CATEGORIES) {
    await prisma.foodCategory.create({ data: cat });
  }
  const categoryMap = new Map<string, string>();
  for (const c of await prisma.foodCategory.findMany()) {
    categoryMap.set(c.nameAr, c.id);
  }

  for (const f of FOODS) {
    await prisma.foodItem.create({
      data: {
        nameAr: f.nameAr,
        nameEn: f.nameEn ?? null,
        categoryId: categoryMap.get(f.category) ?? null,
        portionLabel: f.portionLabel,
        gramsPerPortion: f.gramsPerPortion,
        calories: f.calories,
        proteinG: f.proteinG,
        carbsG: f.carbsG,
        fatG: f.fatG,
        fiberG: f.fiberG,
        sugarsG: f.sugarsG,
        sodiumMg: f.sodiumMg,
        allergens: f.allergens,
        isPreWorkout: f.isPreWorkout ?? false,
        isPostWorkout: f.isPostWorkout ?? false,
        isCompetition: f.isCompetition ?? false,
        isKidFriendly: f.isKidFriendly ?? true,
        isVegetarian: f.isVegetarian ?? false,
        hasLactose: f.hasLactose ?? false,
        hasGluten: f.hasGluten ?? false,
        isCommon: f.isCommon ?? false,
      },
    });
  }

  console.log(`✔ تمت المزامنة: ${FOODS.length} صنفًا عبر ${CATEGORIES.length} تصنيفات`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
