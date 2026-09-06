# مجالس عرب — AGENTS.md

## نظرة عامة
منصة عربية معرفية ومجتمعية. Next.js 15 (App Router) + TypeScript + PostgreSQL 16 + Prisma ORM.

## التشغيل
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
- الويب على المنفذ 3000
- PostgreSQL على المنفذ الداخلي 5432
- Prisma migrations تُطبّق تلقائيًا عند بدء التشغيل

## حساب المدير التجريبي
- البريد: admin@majalis-arab.local
- كلمة المرور: admin12345
- ⚠️ DEMO DATA — غيّرها في الإنتاج

## البنية
- `prisma/schema.prisma` — نموذج البيانات (Entity Core)
- `src/lib/auth.ts` — Auth.js (Credentials + bcrypt + JWT)
- `src/lib/permissions/capabilities.ts` — مصفوفة القدرات (قابلة للاختبار)
- `src/lib/services/*` — طبقة الخدمات (كل فحوص الصلاحيات هنا)
- `src/lib/storage/` — StorageService abstraction
- `src/lib/utils/normalize.ts` — التطبيع العربي للبحث
- `src/middleware.ts` — حماية المسارات

## قواعد أساسية
- RULE 5: الواجهة ليست طبقة أمان — كل فحص في Service Layer
- RULE 6: لا ثقة في بيانات العميل — role/status يُحدّدها الخادم
- RULE 7: فصل تام بين Knowledge و Community
- RULE 9: لا بيانات وهمية في الإنتاج
- RULE 8: لا AI ظاهر في النسخة الأولى

## المراحل
- PHASE 0: التحليل ✅
- PHASE 1: Foundation (الحالي)
- PHASE 2-7: لاحقًا
