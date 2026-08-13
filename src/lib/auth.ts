/*
==================================================
شرح الملف للمبتدئ
==================================================

اسم الملف:
src/lib/auth.ts

وظيفة الملف:
قلب نظام "تسجيل الدخول". يحتوي:
1) authOptions: إعدادات NextAuth (كيفية التحقق من كلمة المرور).
2) getCurrentUser: هل يوجد مستخدم مسجل الآن؟ (تُستخدم في كل الصفحات)
3) requireRole: فحص أن المستخدم له دور معين (مثل admin).

لماذا نحتاجه؟
بدون هذه الملف لا يمكننا حماية الصفحات — أي زائر سيدخل
لوحة التحكم ويشاهد بيانات المستخدمين.

كيف يعمل تسجيل الدخول؟
1. المستخدم يكتب البريد وكلمة المرور في صفحة login.
2. NextAuth يستدعي دالة authorize في الأسفل.
3. authorize يبحث عن المستخدم في قاعدة البيانات (prisma).
4. يقارن كلمة المرور باستخدام bcrypt (لأننا لا نخزن كلمة المرور
   نفسها أبدًا — فقط "هاش" مشفر).
5. صحيح → نخزن بياناته في توكن JWT (كوكي).
6. خاطئ → يرجع null = رفض الدخول.

من يستخدمه؟
- كل الصفحات المحمية: getCurrentUser() ثم redirect لو null.
- واجهات API الحساسة.
==================================================
*/

// ========================================
// 1. الاستيرادات
// ========================================

// next-auth: مكتبة تسجيل الدخول. getServerSession تقرأ الجلسة من الخادم.
// NextAuthOptions: نوع (Type) لشكل الإعدادات.
import { NextAuthOptions, getServerSession } from 'next-auth';
// CredentialsProvider: طريقة تسجيل دخول بـ"بريد + كلمة مرور"
// بدل تسجيل جوجل/فيسبوك.
import CredentialsProvider from 'next-auth/providers/credentials';
// bcrypt: مكتبة تشفير كلمات المرور (هاش). ليست من JavaScript نفسها.
import bcrypt from 'bcryptjs';
// prisma: الاتصال بقاعدة البيانات (من ملفنا src/lib/prisma.ts).
import { prisma } from '@/lib/prisma';

// ========================================
// 2. إعدادات NextAuth
// ========================================

export const authOptions: NextAuthOptions = {
  // session: إعدادات الجلسة.
  session: {
    // strategy: 'jwt' — نخزن بيانات الدخول داخل توكن JWT
    // (بدل التخزين في قاعدة بيانات الجلسات). أبسط وأنسب لهذا المشروع.
    strategy: 'jwt',
    // maxAge: مدة صلاحية الدخول = 30 يومًا.
    // 30 * 24 * 60 * 60 = 30 يوم × ساعات × دقائق × ثوانٍ.
    maxAge: 30 * 24 * 60 * 60, // 30 يومًا
  },
  pages: {
    // عند طلب صفحة محمية وغير مسجل → ينقلنا لصفحة login.
    signIn: '/login',
    // عند خطأ في الدخول → نرجع لصفحة login.
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      // credentials: وصف الحقول التي سيطلبها NextAuth (للعرض فقط).
      credentials: {
        email: { label: 'البريد الإلكتروني', type: 'email' },
        password: { label: 'كلمة المرور', type: 'password' },
      },

      // authorize: أهم دالة — تفحص البيانات وتقرر القبول/الرفض.
      async authorize(credentials) {
        // الخطوة 1: لو لا يوجد بريد أو كلمة مرور → رفض.
        if (!credentials?.email || !credentials?.password) return null;
        // ننظف البريد (حذف مسافات + تحويل لأحرف صغيرة)
        // حتى يكون 'Admin@Top.com' و 'admin@top.com' نفس الشيء.
        const email = credentials.email.trim().toLowerCase();

        // الخطوة 2: البحث عن المستخدم في قاعدة البيانات بهذا البريد.
        // findUnique: ابحث عن سجل واحد فريد (البريد فريد هنا).
        const user = await prisma.user.findUnique({ where: { email } });
        // لو غير موجود → رفض.
        if (!user) return null;
        // لو الحساب معطل (status !== 'active') → رفض.
        if (user.status !== 'active') return null;

        // الخطوة 3: مقارنة كلمة المرور المدخلة مع الهاش المخزن.
        // bcrypt.compare(المدخلة, المخزنة) = تفحص دون فك تشفير.
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        // لو غير صحيحة → رفض.
        if (!valid) return null;

        // الخطوة 4: تحديث "آخر دخول" في قاعدة البيانات (معلومة مفيدة).
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        // الخطوة 5: إرجاع بيانات المستخدم الذي سيدخل.
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          // الصورة قد تكون كبيرة (data URI) — لا تُخزَّن في الجلسة/JWT أبدًا
          // حتى لا يتجاوز حجم الكوكي حد الهيدر (خطأ 494 REQUEST_HEADER_TOO_LARGE).
          image: null,
          role: user.role,
        };
      },
    }),
  ],
  // callbacks: نقاط "خطاف" تنفَّذ أثناء الدورة — نضيف بياناتنا هناك.
  callbacks: {
    // jwt: ينفَّذ عند إنشاء/تحديث التوكن.
    async jwt({ token, user, trigger }) {
      // عند الدخول لأول مرة (يوجد user) → نضيف id وrole إلى التوكن.
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: string }).role ?? 'athlete';
      }
      // تحديث الاسم فقط من قاعدة البيانات — الصورة تُجلب دائمًا عبر getCurrentUser
      // ولا تدخل الجلسة/JWT أبدًا (حفاظًا على صغر حجم الكوكي).
      // trigger === 'update': لو استُدعيت update() من أي مكان (تغيير الاسم مثلاً).
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true },
        });
        if (fresh) {
          token.name = fresh.name;
        }
      }
      return token;
    },
    // session: ينفَّذ عند قراءة الجلسة — ننقل id وrole من التوكن للجلسة.
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  // secret: السر الذي يوقّع به التوكنات (من متغيرات البيئة).
  secret: process.env.NEXTAUTH_SECRET,
};

// ========================================
// 3. نوع المستخدم (TypeScript)
// ========================================

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: string;
};

// ========================================
// 4. دوال مساعدة تستخدمها الصفحات
// ========================================

/*
-----------------------------------------
الدالة: getCurrentSession
-----------------------------------------
وظيفتها: قراءة الجلسة الحالية (كل بياناتها).
Output: session أو null.
-----------------------------------------
*/
export async function getCurrentSession() {
  const session = await getServerSession(authOptions);
  return session;
}

/*
-----------------------------------------
الدالة: getCurrentUser
-----------------------------------------
وظيفتها: إرجاع المستخدم المسجل حاليًا أو null.
Input: لا شيء (يقرأ من الجلسة).
Output: SessionUser أو null.

ترتيب التنفيذ:
1. نقرأ الجلسة من الخادم.
2. لو لا توجد جلسة أو لا يوجد user → null.
3. نجلب صورة المستخدم من قاعدة البيانات (لأنها غير مخزنة في الجلسة).
4. نعيد بياناته.

يتم استدعاؤها من: كل الصفحات المحمية (dashboard، calculator، ...)
وكل واجهات API.
-----------------------------------------
*/
/** يتطلب تسجيل دخول، ويرجع null إن لم يوجد — استخدام في صفحات الخادم */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as SessionUser;

  // الصورة لا تُخزَّن في الجلسة (قد تكون data URI كبيرة)، لذا نجلبها من قاعدة
  // البيانات عند الحاجة فقط — ليبقى حجم الكوكي صغيرًا ولا يحدث خطأ 494.
  let image = u.image ?? null;
  if (!image && u.id) {
    try {
      const db = await prisma.user.findUnique({
        where: { id: u.id },
        select: { image: true },
      });
      image = db?.image ?? null;
    } catch {
      image = null;
    }
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image,
    role: u.role ?? 'athlete',
  };
}

/*
-----------------------------------------
الدالة: requireRole
-----------------------------------------
وظيفتها: فحص أن المستخدم لديه أحد الأدوار المطلوبة.
Input: قائمة أدوار مسموحة (مثل 'admin').
Output: المستخدم لو مسموح، وإلا يرمي خطأ.

قاعدة: throw new Error('UNAUTHENTICATED') يعني "ألقِ خطأ"
يوقف الدالة — تفهمه واجهات API وترد برسالة 401/403.
يتم استدعاؤها من: واجهات الإدارة (admin).
-----------------------------------------
*/
/** يتطلب دورًا معينًا */
export async function requireRole(...roles: string[]) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }
  if (!roles.includes(user.role)) {
    throw new Error('FORBIDDEN');
  }
  return user;
}
