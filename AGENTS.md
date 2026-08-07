# قواعد العمل (AGENTS.md)

مشروع **Top Academy – Smart Swimmer Nutrition** (Next.js 15 + Prisma + Vercel + Neon + GitHub).

## القاعدة الذهبية
بعد **أي** تعديل يطلبه المستخدم في هذا المشروع: أكمِل التعديل، ثم افحصه واعمله **نشر فوري على الإنتاج** حتى يبقى العميل دائمًا على أحدث وضع.
لا تتوقف بعد إجراء التعديل — النشر جزء من إتمام المهمة دائمًا.

## تسلسل الإتمام بعد أي تعديل
1. افحص الأنواع: `node .\node_modules\typescript\bin\tsc --noEmit`
2. الاختبارات: `node .\node_modules\vitest\vitest.mjs run`
3. البناء المحلي: `node .\node_modules\next\dist\bin\next build`
4. النشر على الإنتاج (من مجلد المشروع):
   `node "C:\Users\UseR\AppData\Local\npm-cache\_npx\69f9afb961c37556\node_modules\vercel\dist\index.js" --prod --yes`
   (الطريق `npx vercel` معطوب — استخدم المسار أعلاه مباشرة.)
5. تحقق: `https://nutration-topacademy-dr-walid.vercel.app` يعيد 200.
6. ارفع التعديلات إلى GitHub (فرع `master`):
   `git add ...` ثم `git -c user.name="د. وليد عبد الرحمن" -c user.email="drwalid21395@users.noreply.github.com" commit -m "..."` ثم `git push origin master`

## تحذير شديد: قاعدة بيانات المستخدمين
- `db:push` / `db:migrate` / `db:seed` / `scripts/sync-foods.ts` على **قاعدة الإنتاج (Neon)** تُنفَّذ **فقط** بطلب صريح من المستخدم.
- لا تنفّذ أي `deleteMany`/`updateMany` واسع على جداول المستخدمين في الإنتاج أبدًا.
- مزامنة الأطعمة والتصنيفات فقط (جداول مرجعية عامة) مسموحة بأمان عبر `scripts/sync-foods.ts` لأنها لا تلمس بيانات المستخدمين.
- `DATABASE_URL` الإنتاجية سرّ — لا تطبعها في المخرجات ولا ترفعها في الالتزامات. `.env*` و`.neon` مستثناة من git.

## قواعد السويتش بين قواعد البيانات
- المحلي: SQLite — `node scripts/use-db.js sqlite` ثم `node .\node_modules\prisma\build\index.js generate`.
- الإنتاج: PostgreSQL — `node scripts/use-db.js postgres` ثم التوليد، مع `DATABASE_URL` من Vercel.
- بعد أي سكربت ضد الإنتاج: أعد `sqlite` وأعد التوليد وأعد تشغيل الخادم المحلي.

## إعدادات البيئة (لا تُرفع)
- `GROQ_API_KEY` لتحليل الوجبات (النموذج `qwen/qwen3.6-27b`، `max_tokens:1500`).
- `DATABASE_URL` المحلي: `file:./dev.db`. الإنتاج: Neon (مخفي في Vercel كنوع `sensitive`).
- حساب الإدارة: `admin@top.academy` / `Admin@1234` — تجريبي.

## مسار مؤقت معروف (للاسترجاع عند الحاجة فقط)
لجلب سرّ من بيئة Vercel: أضف `src/app/api/admin/dbg/route.ts` محميًا بدور `admin` يعيد `process.env.DATABASE_URL`، انشر، ادخل بحساب الأدمن عبر `/api/auth/callback/credentials` مع `csrfToken`، اجلب السر، ثم **احذف المسار وأعد النشر** فورًا. لا تتركه في الإنتاج.
