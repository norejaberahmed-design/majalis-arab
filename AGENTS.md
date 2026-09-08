# قبائل — AGENTS.md

## نظرة عامة
منصة عربية معرفية للمعرفة القبلية والتاريخية. Next.js 15 (App Router) + TypeScript + PostgreSQL 16 + Prisma ORM + NextAuth.

## التشغيل
```bash
docker compose -f docker-compose.base44.yml up -d --build
```
- الويب على المنفذ 3000
- PostgreSQL على المنفذ الداخلي 5432
- Prisma db push تُطبّق تلقائيًا عند بدء التشغيل
- Seed ينشئ حساب مدير تجريبي

## حساب المدير التجريبي
- البريد: admin@majalis-arab.local
- كلمة المرور: admin12345
- ⚠️ DEMO DATA — غيّرها في الإنتاج

## البنية الحالية (PHASE 1: Foundation)
- `prisma/schema.prisma` — نموذج البيانات (User, Entity, Relationship, EntityVersion, AuditLog, Session)
- `src/lib/auth.ts` — NextAuth (Credentials + bcrypt + JWT)
- `src/lib/permissions/capabilities.ts` — مصفوفة القدرات (RBAC، قابلة للاختبار)
- `src/lib/services/*` — طبقة الخدمات (Users, Audit)
- `src/lib/storage/` — StorageService abstraction (Local → S3 قابل للترحيل)
- `src/lib/utils/normalize.ts` — التطبيع العربي للبحث
- `src/lib/validations/auth.schema.ts` — Zod schemas
- `src/middleware.ts` — حماية المسارات (profile, settings, dashboard, admin)

## الصفحات
- `/` — الرئيسية (بحث + أقسام)
- `/search` — البحث في الكيانات
- `/login`, `/register` — المصادقة
- `/dashboard` — لوحة المستخدم
- `/profile`, `/settings` — الملف الشخصي والإعدادات
- `/admin`, `/admin/users` — الإدارة (ADMIN فقط)

## API Routes
- `POST /api/register` — تسجيل مستخدم جديد
- `GET/PUT /api/profile` — الملف الشخصي
- `GET/PUT /api/settings` — إعدادات الخصوصية
- `POST /api/admin/users/[userId]/role` — تغيير دور (ADMIN)
- `POST /api/admin/users/[userId]/status` — تغيير حالة (ADMIN)
- `GET/POST /api/auth/[...nextauth]` — NextAuth

## قواعد أساسية
- RULE 5: الواجهة ليست طبقة أمان — كل فحص في Service Layer
- RULE 6: لا ثقة في بيانات العميل — role/status يُحدّدها الخادم
- RULE 7: فصل تام بين Knowledge و Community
- RULE 9: لا بيانات وهمية في الإنتاج
- RULE 8: لا AI ظاهر في النسخة الأولى

## ما يعمل ✅
- تسجيل/دخول المستخدمين
- RBAC (5 أدوار، مصفوفة قدرات)
- Middleware لحماية المسارات
- Audit logging (append-only)
- البحث الأساسي في الكيانات
- لوحة الإدارة (إدارة المستخدمين)
- Storage abstraction
- التطبيع العربي للبحث
- TypeScript strict mode (no errors)
- Next.js production build (نجح)
- Zod validation على جميع API routes (بما فيها settings — تم إصلاح mass assignment)
- Error boundary (`src/app/error.tsx`)
- `.env.example` يوثّق جميع متغيرات البيئة المطلوبة

## PHASE 5.5 — Production Boundary Verification
تقرير كامل في `docs/PHASE_5_5_BOUNDARY_VERIFICATION.md`.
تم إصلاح:
- Mass assignment على `PUT /api/settings` (أضيف Zod validation)
- تسريب أخطاء داخلية في API routes (تم تعقيم رسائل الخطأ)
- عدم وجود error boundary (تم إضافة `src/app/error.tsx`)
- عدم وجود `.env.example` (تم إنشاؤه)

## ما هو غير مكتمل (مراحل قادمة)
- Knowledge Model: Claims, Evidence, Sources, Narratives, Conflicts
- Source Architecture: SourceEdition, SourceDocument, SourcePage, SourcePassage
- Entity Identity: EntityIdentity, EntityAlias (historical names, OCR variants, confidence)
- Extended Entity Types: CLAN, CITY, VILLAGE, HISTORICAL_EVENT, ORGANIZATION, AUTHOR, BOOK, SOURCE
- Arabic Search Engine: pg_trgm, full-text search, ranking
- Entity Pages: /tribes/[slug], /families/[slug], /people/[slug], /places/[slug], /sources/[slug]
- Review Workflow: DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED/REJECTED
- User Contribution: "عرّف بقبيلتك"
- Community: Communities, Majlis, Posts, Comments, Questions
- Research Workspace
- Messaging
- OCR Pipeline
- NER, Entity Resolution, Conflict Engine, RAG
- Recommendations
- SEO pages
- Security hardening
- Testing (unit, integration, E2E)
- Production hardening

## التحقق
```bash
# فحص الأنواع
docker compose -f docker-compose.base44.yml exec -T web sh -c "npx tsc --noEmit"
# بناء الإنتاج
docker compose -f docker-compose.base44.yml exec -T web sh -c "npm run build"
# Seed
docker compose -f docker-compose.base44.yml exec -T web sh -c "npx prisma db seed"
```
