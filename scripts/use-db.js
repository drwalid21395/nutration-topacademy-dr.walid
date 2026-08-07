#!/usr/bin/env node
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
