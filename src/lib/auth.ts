import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 يومًا
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'البريد الإلكتروني', type: 'email' },
        password: { label: 'كلمة المرور', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        if (user.status !== 'active') return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

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
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: string }).role ?? 'athlete';
      }
      // تحديث الاسم فقط من قاعدة البيانات — الصورة تُجلب دائمًا عبر getCurrentUser
      // ولا تدخل الجلسة/JWT أبدًا (حفاظًا على صغر حجم الكوكي).
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
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: string;
};

export async function getCurrentSession() {
  const session = await getServerSession(authOptions);
  return session;
}

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
