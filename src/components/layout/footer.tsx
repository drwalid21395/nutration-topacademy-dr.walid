import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { BRAND, CONTACT, MEDICAL_DISCLAIMER } from '@/lib/constants';

const FOOTER_LINKS = {
  'روابط سريعة': [
    { href: '/about', label: 'من نحن' },
    { href: '/supplements', label: 'دليل المكملات' },
    { href: '/competition-mode', label: 'وضع البطولة' },
    { href: '/contact', label: 'تواصل معنا' },
  ],
  'السياسات': [
    { href: '/privacy', label: 'سياسة الخصوصية' },
    { href: '/terms', label: 'شروط الاستخدام' },
    { href: '/medical-disclaimer', label: 'إخلاء المسؤولية الطبية' },
  ],
};

export function Footer() {
  return (
    <footer className="mt-auto bg-ocean-950 text-slate-300">
      <div className="container-app py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <Logo variant="light" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              {BRAND.productNameAr} — منصة ذكية لإدارة التغذية الرياضية للسباحين: حساب الاحتياجات، خطط غذائية مخصصة، تحليل الوجبات بالكاميرا، ومتابعة يومية شاملة.
            </p>
            <a
              href={CONTACT.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-500/15 px-4 py-2 text-sm font-bold text-green-400 transition-colors hover:bg-green-500/25"
            >
              <MessageCircle className="h-4 w-4" />
              واتساب: {CONTACT.whatsappDisplay}
            </a>
          </div>
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="mb-4 text-sm font-bold text-white">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-slate-400 transition-colors hover:text-ocean-300">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-slate-400">
          <p className="mb-2 font-bold text-gold-400">تنبيه إرشادي:</p>
          <p>{MEDICAL_DISCLAIMER}</p>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
          <p className="font-bold text-slate-300">{BRAND.doctorTitle}: {BRAND.doctor}</p>
          <p className="mt-1">{BRAND.nameAr} — {BRAND.nameEn} · {BRAND.productName} © {BRAND.year}</p>
        </div>
      </div>
    </footer>
  );
}
