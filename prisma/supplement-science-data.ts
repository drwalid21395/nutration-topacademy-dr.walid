/**
 * بيانات علمية مساندة لحاسبة المكملات:
 * 1) المكونات الكنسية مع الحدود العليا الآمنة (لكشف التكرار والتجاوز).
 * 2) المراجع العلمية لكل مكمل.
 * كل الحدود تقديرية استرشادية من مراجع عامة، وليست حدودًا علاجية إلزامية.
 */
export const SUPPLEMENT_INGREDIENTS: {
  nameAr: string;
  nameEn: string;
  unit: string;
  upperLimit: number | null;
  severeLimit: number | null;
  sourceAr: string;
}[] = [
  { nameAr: 'كرياتين', nameEn: 'creatine', unit: 'g', upperLimit: 10, severeLimit: 15, sourceAr: 'ISSN 2017' },
  { nameAr: 'كافيين', nameEn: 'caffeine', unit: 'mg', upperLimit: 400, severeLimit: 600, sourceAr: 'EFSA 2015' },
  { nameAr: 'بيتا ألانين', nameEn: 'beta-alanine', unit: 'g', upperLimit: 6.4, severeLimit: 8, sourceAr: 'ISSN 2017' },
  { nameAr: 'صوديوم', nameEn: 'sodium', unit: 'mg', upperLimit: 2300, severeLimit: 3000, sourceAr: 'AHA' },
  { nameAr: 'فيتامين د', nameEn: 'vitamin d', unit: 'IU', upperLimit: 4000, severeLimit: 10000, sourceAr: 'Endocrine Society' },
  { nameAr: 'حديد', nameEn: 'iron', unit: 'mg', upperLimit: 45, severeLimit: 60, sourceAr: 'NIH ODS' },
  { nameAr: 'كالسيوم', nameEn: 'calcium', unit: 'mg', upperLimit: 2500, severeLimit: 3000, sourceAr: 'NIH ODS' },
  { nameAr: 'مغنيسيوم', nameEn: 'magnesium', unit: 'mg', upperLimit: 350, severeLimit: 700, sourceAr: 'NIH ODS' },
  { nameAr: 'زنك', nameEn: 'zinc', unit: 'mg', upperLimit: 40, severeLimit: 60, sourceAr: 'NIH ODS' },
  { nameAr: 'حمض الفوليك', nameEn: 'folate', unit: 'mcg', upperLimit: 1000, severeLimit: 1500, sourceAr: 'NIH ODS' },
  { nameAr: 'فيتامين سي', nameEn: 'vitamin c', unit: 'mg', upperLimit: 2000, severeLimit: 4000, sourceAr: 'NIH ODS' },
  { nameAr: 'أوميجا 3', nameEn: 'omega 3', unit: 'g', upperLimit: 5, severeLimit: 8, sourceAr: 'AIS' },
  { nameAr: 'بروتين', nameEn: 'protein', unit: 'g', upperLimit: 60, severeLimit: 100, sourceAr: 'تقدير مسحوق إضافي يومي' },
];

export const SUPPLEMENT_REFERENCES: {
  supplementKey: string;
  organization: string;
  year: number;
  title: string;
  url?: string;
  noteAr: string;
}[] = [
  { supplementKey: 'whey', organization: 'ISSN', year: 2017, title: 'Position stand: protein and exercise', url: 'https://jissn.biomedcentral.com/', noteAr: 'بروتين 1.4-2.0 جم/كجم للرياضيين.' },
  { supplementKey: 'creatine', organization: 'ISSN', year: 2017, title: 'Creatine supplementation position stand', url: 'https://jissn.biomedcentral.com/', noteAr: '3-5 جم/يوم بعد تحميل اختياري.' },
  { supplementKey: 'caffeine', organization: 'AIS', year: 2019, title: 'Caffeine — Supplements Hub', url: 'https://www.sportaus.gov.au/', noteAr: '1-3 ملجم/كجم قبل التمرين.' },
  { supplementKey: 'beta-alanine', organization: 'ISSN', year: 2017, title: 'Beta-alanine position stand', url: 'https://jissn.biomedcentral.com/', noteAr: '3.2-6.4 جم/يوم.' },
  { supplementKey: 'bicarbonate', organization: 'AIS', year: 2018, title: 'Sodium Bicarbonate', url: 'https://www.sportaus.gov.au/', noteAr: 'يُجرَّب في التدريب قبل البطولة.' },
  { supplementKey: 'nitrate', organization: 'AIS', year: 2023, title: 'Beetroot / Nitrate', url: 'https://www.sportaus.gov.au/', noteAr: 'الغذاء أولًا — عصير شمندر 300-500 مل.' },
  { supplementKey: 'carb-drink', organization: 'AIS', year: 2023, title: 'Sports Drinks', url: 'https://www.sportaus.gov.au/', noteAr: '30-60 جم كربوهيدرات/ساعة.' },
  { supplementKey: 'electrolytes', organization: 'AIS', year: 2023, title: 'Hydration', url: 'https://www.sportaus.gov.au/', noteAr: 'تعويض الصوديوم حسب التعرق فقط.' },
  { supplementKey: 'vitamin-d', organization: 'Endocrine Society', year: 2011, title: 'Vitamin D practice guidelines', url: 'https://academic.oup.com/', noteAr: 'الجرعة تُحدد بالتحليل (25-OH-D).' },
  { supplementKey: 'iron', organization: 'NIH ODS', year: 2023, title: 'Iron fact sheet', url: 'https://ods.od.nih.gov/', noteAr: 'لا يُعطى دون نقص مثبت.' },
  { supplementKey: 'calcium', organization: 'NIH ODS', year: 2023, title: 'Calcium fact sheet', url: 'https://ods.od.nih.gov/', noteAr: 'الحد الأعلى 2500 ملجم/يوم.' },
  { supplementKey: 'magnesium', organization: 'NIH ODS', year: 2022, title: 'Magnesium fact sheet', url: 'https://ods.od.nih.gov/', noteAr: '200-400 ملجم/يوم.' },
  { supplementKey: 'zinc', organization: 'NIH ODS', year: 2022, title: 'Zinc fact sheet', url: 'https://ods.od.nih.gov/', noteAr: 'الحد الأعلى 40 ملجم/يوم.' },
  { supplementKey: 'vitamin-b12', organization: 'NIH ODS', year: 2022, title: 'B12 fact sheet', url: 'https://ods.od.nih.gov/', noteAr: 'للنباتيين إلزامي تقريبًا.' },
  { supplementKey: 'folate', organization: 'NIH ODS', year: 2022, title: 'Folate fact sheet', url: 'https://ods.od.nih.gov/', noteAr: 'الحد الأعلى 1000 مكجم/يوم.' },
  { supplementKey: 'vitamin-c', organization: 'NIH ODS', year: 2022, title: 'Vitamin C fact sheet', url: 'https://ods.od.nih.gov/', noteAr: 'الحد الأعلى 2000 ملجم/يوم.' },
  { supplementKey: 'omega3', organization: 'AIS', year: 2023, title: 'Fish Oil', url: 'https://www.sportaus.gov.au/', noteAr: '1-3 جم EPA/DHA.' },
  { supplementKey: 'probiotics', organization: 'ISSN', year: 2019, title: 'Probiotics for athletes', url: 'https://jissn.biomedcentral.com/', noteAr: 'دعم محتمل للمناعة والجهاز الهضمي.' },
  { supplementKey: 'collagen', organization: 'ISSN', year: 2022, title: 'Collagen supplementation', url: 'https://jissn.biomedcentral.com/', noteAr: 'أدلة محدودة (درجة C).' },
  { supplementKey: 'meal-replacement', organization: 'AIS', year: 2022, title: 'Meal replacements', url: 'https://www.sportaus.gov.au/', noteAr: 'وجبة عملية وليست بديلًا دائمًا.' },
];
