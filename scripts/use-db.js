#!/usr/bin/env node
// ==================================================
// شرح الملف للمبتدئ
// ==================================================
// اسم الملف: scripts/use-db.js
//
// وظيفة الملف:
// سكربت مساعد يبدّل مخطط قاعدة البيانات:
// - node scripts/use-db.js sqlite   ← ينسخ schema.sqlite.prisma إلى schema.prisma
// - node scripts/use-db.js postgres  ← ينسخ schema.postgres.prisma إلى schema.prisma
//
// لماذا نحتاجه؟
// المشروع يستخدم SQLite محليًا (ملف واحد) وPostgreSQL في الإنتاج.
// بدل صيانة ملف schema مزدوج، نخزّن مخططين وننسخ المطلوب منهما
// إلى الملف الرئيسي schema.prisma الذي يقرؤه Prisma.
//
// متى يعمل؟
// بأمر npm run db:sqlite أو npm run db:postgres (من package.json).
//
// من يستدعيه؟
// سكربتات npm فقط — لا علاقة له بمسار التطبيق.
// ==================================================

// ========================================
// 1. تجهيز الأدوات
// ========================================
// require('fs') و require('path'): أدوات Node.js الجاهزة
// للتعامل مع الملفات والمسارات (من اللغة نفسها — لا مكتبات خارجية).
/**
 * مبدّل قاعدة البيانات — ينسخ الـ schema المطلوب إلى prisma/schema.prisma
 * الاستخدام: npm run db:sqlite   أو   npm run db:postgres
 */
const fs = require('fs');
const path = require('path');

const target = process.argv[2];

if (!['sqlite', 'postgres'].includes(target)) {
  console.error('الاستخدام: node scripts/use-db.js <sqlite|postgres>');
  process.exit(1);
}

const prismaDir = path.join(process.cwd(), 'prisma');
const source = path.join(prismaDir, `schema.${target}.prisma`);
const dest = path.join(prismaDir, 'schema.prisma');

if (!fs.existsSync(source)) {
  console.error(`ملف غير موجود: ${source}`);
  process.exit(1);
}

fs.copyFileSync(source, dest);
console.log(`✔ تم التبديل إلى ${target === 'postgres' ? 'PostgreSQL (الإنتاج)' : 'SQLite (التجربة المحلية)'}`);
console.log('الخطوة التالية: npm run db:generate && npm run db:push && npm run db:seed');
