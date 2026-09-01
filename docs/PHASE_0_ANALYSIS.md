# تقرير PHASE 0 — التحليل والتصميم
## منصة «المجالس العربية»

> هذا التقرير يغطي التحليل الكامل للمتطلبات: البنية التقنية، نموذج البيانات، الأدوار، الصلاحيات، الصفحات، سير العمل، الأمن، وخطة الاختبار.
> **لا يتم تنفيذ أي كود في هذه المرحلة.** ينتظر التنفيذ موافقة المستخدم على هذا التقرير.

---

## 1. البنية التقنية (Architecture)

### 1.1 القرار التقني

| المكوّن | الاختيار | السبب |
|---|---|---|
| الإطار | Next.js 15 (App Router) | Fullstack في كود واحد، Server Components، API Routes، SSR/SSG |
| اللغة | TypeScript | أمان الأنواع، قابلية الصيانة |
| قاعدة البيانات | PostgreSQL | علائقية قوية، تدعم العلاقات المعقدة والاستعلامات الثقيلة |
| ORM | Prisma | أمان أنواع كامل، migrations موثوقة، DX ممتاز |
| المصادقة | Auth.js v5 (NextAuth) | أصلي لـ Next.js، يدعم Credentials + JWT sessions |
| التنسيق | TailwindCSS v4 | RTL أصلي، Mobile-first، utility-first |
| التحقق من المدخلات | Zod | تحقق من المخطط + استنتاج أنواع |
| تخزين الملفات | نظام ملفات محلي + طبقة تجريد | قابل للترقية لـ S3/Cloud لاحقًا دون تغيير الكود |
| الخط العربي | IBM Plex Sans Arabic أو Tajawal | وضوح عالٍ، احترافي، يدعم RTL |

### 1.2 المبادئ المعمارية

- **Monolith واحد**: Frontend + Backend + API في كود Next.js واحد. لا Microservices، لا Redis، لا قواعد بيانات خارجية (قاعدة #55).
- **Server-side authorization**: كل صلاحية تُطبّق على مستوى Server Component أو API Route أو Server Action — لا يعتمد على إخفاء الأزرار.
- **Source of truth في قاعدة البيانات**: كل معلومة معرفية = Claim مع مصادر وحالة ودرجة ثقة.
- **فصل المعرفة عن الاجتماعي**: المحتوى المعرفي يحتاج مصادر ومراجعة؛ المحتوى الاجتماعي (المجالس) لا يتحول تلقائيًا إلى معلومة موثقة.
- **قابلية التوسع مستقبلاً**: تصميم يسمح بإضافة API خارجي، تطبيق جوال، اشتراكات، AI — لكن لا يُنفّذ أي منها الآن.

### 1.3 البنية المادية (Docker Compose)

```
┌─────────────────────────────────────┐
│         Next.js App (port 3000)      │
│  ┌───────────┐  ┌────────────────┐  │
│  │ Frontend  │  │ API Routes /   │  │
│  │ (RSC)     │  │ Server Actions  │  │
│  └───────────┘  └───────┬────────┘  │
│                         │           │
│              ┌──────────▼────────┐  │
│              │   Prisma Client   │  │
│              └──────────┬────────┘  │
└─────────────────────────┼───────────┘
                          │
              ┌───────────▼───────────┐
              │   PostgreSQL (5432)   │
              └───────────────────────┘
```

خدمتان فقط: تطبيق Next.js + PostgreSQL. لا خدمات إضافية.

---

## 2. نموذج البيانات (Database Schema)

### 2.1 قائمة الكيانات (Entities)

#### المستخدمون والصلاحيات
| الكيان | الوصف |
|---|---|
| **User** | المستخدم: بريد، كلمة مرور مشفّرة، اسم عرض، صورة، نبذة، دور، إعدادات خصوصية |
| **Account** | (Auth.js) بيانات الجلسة/الرموز |
| **Session** | (Auth.js) جلسة المستخدم |

#### المعرفة الأساسية
| الكيان | الوصف |
|---|---|
| **Tribe** | القبيلة: اسم، أسماء بديلة، وصف، حالة معرفية، مناطق |
| **TribeBranch** | فرع القبيلة: اسم، وصف، قبيلة أب (اختياري) |
| **Family** | العائلة: اسم، أسماء بديلة، وصف، حالة معرفية، قبيلة مرتبطة (اختياري) |
| **FamilyBranch** | فرع العائلة: اسم، وصف، عائلة أب (اختياري) |
| **Person** | الشخصية: اسم، أسماء بديلة، نبذة، ميلاد، وفاة، أماكن، قبيلة/عائلة (عند وجود مصدر فقط) |

#### المصادر والوثائق
| الكيان | الوصف |
|---|---|
| **Source** | المصدر: عنوان، مؤلف، ناشر، سنة نشر، نوع، رابط، مرجع صفحة، وصف، مستوى موثوقية |
| **Document** | وثيقة مرفوعة: ملف، نوع، وصف، بيانات المصدر، حالة تحقق، رافع، صلاحيات وصول |

#### الادعاءات والروايات
| الكيان | الوصف |
|---|---|
| **Claim** | ادعاء معرفي: نص، حالة، درجة ثقة، كيان مستهدف، مصادر، مقدّم، مراجِع |
| **ClaimSource** | ربط Claim ↔ Source (علاقة متعددة) |
| **Narrative** | رواية: عنوان، وصف، مصادر |
| **NarrativeSource** | ربط Narrative ↔ Source (علاقة متعددة) |
| **Conflict** | تعارض: يربط روايتين، نقاط اتفاق، نقاط اختلاف، حالة الأدلة |

#### المجالس الاجتماعية
| الكيان | الوصف |
|---|---|
| **Majlis** | مجلس: اسم، نوع (عام/متخصص)، وصف، منشئ |
| **Post** | منشور: محتوى، مجلس، مستخدم |
| **Comment** | تعليق: منشور، مستخدم، تعليق أب (ردود) |
| **Like** | إعجاب: مستخدم + كيان (متعدد الأنواع) |
| **Bookmark** | حفظ: مستخدم + كيان (متعدد الأنواع) |

#### الإشراف والمراجعة
| الكيان | الوصف |
|---|---|
| **Report** | بلاغ: مبلّغ، كيان، سبب، وصف، حالة |
| **ModerationAction** | إجراء إشراف: مشرف، كيان، نوع الإجراء، سبب |
| **ReviewRequest** | طلب مراجعة: ادعاء، مراجِع، حالة، قرار، ملاحظات |
| **AuditLog** | سجل تدقيق: مستخدم، إجراء، كيان، قيمة سابقة، قيمة جديدة، سبب، وقت |

### 2.2 العلاقات الرئيسية

```
Tribe ──< TribeBranch
Tribe ──< Family
Family ──< FamilyBranch
Tribe ──< Person
Family ──< Person

Claim ──< ClaimSource >── Source
Narrative ──< NarrativeSource >── Source
Conflict >── Narrative (A)
Conflict >── Narrative (B)

Claim ──> Tribe | Family | Person  (polymorphic target)

Majlis ──< Post ──< Comment
Post ──< Like
Post ──< Bookmark

User ──< Post
User ──< Comment
User ──< Report
User ──< ReviewRequest
User ──< AuditLog
```

### 2.3 الحالات والثوابت (Enums)

```typescript
// دور المستخدم
enum Role { USER, CONTRIBUTOR, RESEARCHER, MODERATOR, ADMIN }

// حالة الادعاء
enum ClaimStatus { DRAFT, PENDING_REVIEW, UNDER_REVIEW, VERIFIED, DISPUTED, REJECTED, ARCHIVED }

// نوع المحتوى المعرفي
enum KnowledgeType {
  VERIFIED_FACT, SOURCE_CLAIM, ORAL_TRADITION,
  USER_CLAIM, DISPUTED_CLAIM, UNVERIFIED
}

// درجة الثقة
enum Confidence { HIGH, MEDIUM, LOW, UNKNOWN }

// نوع المصدر
enum SourceType {
  BOOK, ARTICLE, DOCUMENT, ARCHIVE, OFFICIAL,
  INTERVIEW, ORAL_HISTORY, WEBSITE, IMAGE, VIDEO, OTHER
}

// مستوى موثوقية المصدر
enum ReliabilityLevel { HIGH, MEDIUM, LOW, UNKNOWN }

// حالة الوثيقة
enum DocumentVerification { PENDING, VERIFIED, REJECTED, NEEDS_REVIEW }

// حالة البلاغ
enum ReportStatus { PENDING, UNDER_REVIEW, RESOLVED, DISMISSED }

// سبب البلاغ
enum ReportReason {
  MISINFORMATION, ABUSE, VIOLATION, IMPERSONATION,
  FAKE_SOURCE, SENSITIVE, OTHER
}

// حالة المراجعة
enum ReviewStatus { PENDING, APPROVED, REJECTED, REQUEST_EVIDENCE }
```

### 2.4 سياسات البيانات

- **لا بيانات وهمية**: لا قبائل/عائلات/أنساب/شخصيات تجريبية تظهر للمستخدم كحقيقية.
- **بيانات الاختبار**: تُوسم بوضوح `DEMO DATA — NOT REAL` ولا تظهر في الواجهة العامة.
- **عدم الحذف**: لا تُحذف كيانات أثناء التطوير إلا لسبب هندسي موثّق (قاعدة #54).

---

## 3. الأدوار (Roles)

| الدور | الهدف |
|---|---|
| **USER** | مستخدم عادي: بحث، قراءة، متابعة، مشاركة في المجالس، اقتراح تصحيح، إبلاغ |
| **CONTRIBUTOR** | مساهم: اقتراح معلومات، إضافة مصادر، رفع وثائق، اقتراح علاقات — كلها تمر بالمراجعة |
| **RESEARCHER** | باحث/مراجع: مراجعة المصادر والادعاءات، مقارنة الروايات، اعتماد/رفض معلومات |
| **MODERATOR** | مشرف: المنشورات، التعليقات، البلاغات، إساءة الاستخدام — لا صلاحيات تعديل المعرفة |
| **ADMIN** | مدير: صلاحيات كاملة + إدارة المستخدمين والأدوار + Audit Logs |

التسلسل الهرمي: `USER < CONTRIBUTOR < RESEARCHER < MODERATOR < ADMIN` — لكن MODERATOR لا يرث صلاحيات RESEARCHER المعرفية (دوران مستقلان).

---

## 4. مصفوفة الصلاحيات (Permissions)

> كل صلاحية تُطبّق على مستوى الخادم (Server Component / API Route / Server Action).

| العملية | USER | CONTRIBUTOR | RESEARCHER | MODERATOR | ADMIN |
|---|---|---|---|---|---|
| البحث والقراءة | ✅ | ✅ | ✅ | ✅ | ✅ |
| إنشاء منشور/تعليق | ✅ | ✅ | ✅ | ✅ | ✅ |
| الإعجاب/الحفظ/المتابعة | ✅ | ✅ | ✅ | ✅ | ✅ |
| إرسال اقتراح تصحيح | ✅ | ✅ | ✅ | ✅ | ✅ |
| الإبلاغ عن محتوى | ✅ | ✅ | ✅ | ✅ | ✅ |
| اقتراح معلومة (Claim) | ❌ | ✅ | ✅ | ❌ | ✅ |
| إضافة مصدر | ❌ | ✅ | ✅ | ❌ | ✅ |
| رفع وثيقة | ❌ | ✅ | ✅ | ❌ | ✅ |
| اقتراح شخصية/علاقة | ❌ | ✅ | ✅ | ❌ | ✅ |
| مراجعة الادعاءات | ❌ | ❌ | ✅ | ❌ | ✅ |
| اعتماد/رفض معلومة | ❌ | ❌ | ✅ | ❌ | ✅ |
| مقارنة الروايات | ❌ | ❌ | ✅ | ❌ | ✅ |
| إدارة المنشورات/التعليقات | ❌ | ❌ | ❌ | ✅ | ✅ |
| معالجة البلاغات | ❌ | ❌ | ❌ | ✅ | ✅ |
| إدارة المستخدمين والأدوار | ❌ | ❌ | ❌ | ❌ | ✅ |
| إدارة المصادر المعتمدة | ❌ | ❌ | ❌ | ❌ | ✅ |
| مشاهدة Audit Logs | ❌ | ❌ | ❌ | ❌ | ✅ |
| تعديل معلومة موثقة مباشرة | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 5. الصفحات (Pages)

### 5.1 الصفحات العامة
| المسار | الصفحة |
|---|---|
| `/` | الرئيسية — البحث هو المحور + أقسام (القبائل، العائلات، الشخصيات، المصادر، المجالس) + قسم «استكشف» (محتوى معتمد فقط) |
| `/search` | نتائج البحث — مرتبة حسب النوع/درجة التوثيق |
| `/tribes` | قائمة القبائل (pagination) |
| `/tribes/[id]` | صفحة القبيلة: اسم، أسماء بديلة، وصف، حالة معرفية، مناطق، فروع، شخصيات، ادعاءات، روايات، مصادر، وثائق |
| `/families` | قائمة العائلات |
| `/families/[id]` | صفحة العائلة |
| `/people` | قائمة الشخصيات |
| `/people/[id]` | صفحة الشخصية |
| `/sources` | قائمة المصادر |
| `/sources/[id]` | صفحة المصدر |
| `/majalis` | قائمة المجالس |
| `/majalis/[id]` | مجلس: منشورات، تعليقات، إعجاب |

### 5.2 صفحات المصادقة
| المسار | الصفحة |
|---|---|
| `/auth/login` | تسجيل الدخول |
| `/auth/register` | التسجيل |

### 5.3 صفحات المستخدم
| المسار | الصفحة |
|---|---|
| `/profile` | الملف الشخصي العام |
| `/profile/settings` | إعدادات الحساب + الخصوصية |
| `/dashboard` | لوحة المستخدم: ملفي، المحفوظات، منشوراتي، اقتراحاتي، مراجعاتي |

### 5.4 لوحات الإدارة
| المسار | الصفحة |
|---|---|
| `/admin` | لوحة المدير: نظرة عامة |
| `/admin/users` | إدارة المستخدمين |
| `/admin/roles` | إدارة الأدوار |
| `/admin/tribes` | إدارة القبائل |
| `/admin/families` | إدارة العائلات |
| `/admin/people` | إدارة الشخصيات |
| `/admin/claims` | إدارة الادعاءات |
| `/admin/sources` | إدارة المصادر |
| `/admin/documents` | إدارة الوثائق |
| `/admin/narratives` | إدارة الروايات |
| `/admin/conflicts` | إدارة التعارضات |
| `/admin/reviews` | طابور المراجعة |
| `/admin/reports` | البلاغات |
| `/admin/moderation` | الإشراف |
| `/admin/audit` | سجلات التدقيق |

### 5.5 لوحة الباحث/المراجع
| المسار | الصفحة |
|---|---|
| `/researcher` | نظرة عامة |
| `/researcher/pending` | الادعاءات المعلقة |
| `/researcher/sources` | مراجعة المصادر |
| `/researcher/conflicts` | التعارضات |
| `/researcher/queue` | طابور المراجعة |
| `/researcher/changes` | آخر التغييرات |

### 5.6 التنقل (Navigation)
- **Desktop**: شريط علوي (Header) مع البحث + روابط الأقسام + قائمة المستخدم
- **Mobile**: Bottom Navigation (الرئيسية، المجالس، بحث، حسابي) — يظهر فقط عند الحاجة

---

## 6. سير العمل (Workflows)

### 6.1 سير عمل الادعاء (Claim Workflow)

```
مستخدم/مساهم ينشئ Claim
        │
        ▼
    DRAFT (مسودة)
        │  → إرسال للمراجعة
        ▼
  PENDING_REVIEW (معلّق)
        │  → باثث يفتحه
        ▼
  UNDER_REVIEW (قيد المراجعة)
        │
   ┌────┴────┬─────────┐
   ▼         ▼         ▼
VERIFIED  REJECTED  REQUEST_EVIDENCE
(موثّق)   (مرفوض)   (طلب أدلة)
   │
   ├──→ DISPUTED (متعارض) — عند ظهور تعارض
   │
   └──→ ARCHIVED (مؤرشف)
```

- كل انتقال حالة يُسجّل في AuditLog.
- لا يصبح VERIFIED إلا بعد مراجعة باحث (RESEARCHER/ADMIN).
- DISPUTED يُربط بـ Conflict بين روايتين.

### 6.2 سير عمل البلاغ (Report Workflow)

```
مستخدم يبلّغ عن محتوى
        │
        ▼
   PENDING (معلّق)
        │  → مشرف يفتحه
        ▼
  UNDER_REVIEW
        │
   ┌────┴────┐
   ▼         ▼
RESOLVED  DISMISSED
(حُلّ)    (رُفض)
   │
   ▼
ModerationAction
(حذف/إخفاء/تحذير/حظر)
```

### 6.3 سير عمل الوثائق (Document Workflow)

```
مساهم يرفع وثيقة
        │
        ▼
  PENDING (انتظار)
        │  → مراجعة عند الحاجة
        ▼
  VERIFIED / REJECTED / NEEDS_REVIEW
```

رفع الوثيقة ≠ اعتمادها. تمر بالمراجعة عند الحاجة.

### 6.4 سير عمل المراجعة (Review Workflow)

```
Claim → PENDING_REVIEW
        │
        ▼
  ReviewRequest (يعيّن باحث)
        │
        ▼
  UNDER_REVIEW → APPROVED / REJECTED / REQUEST_EVIDENCE
```

كل قرار موثّق في ReviewRequest + AuditLog. لا تعديل بدون تسجيل.

---

## 7. الأمن (Security)

### 7.1 المصادقة (Authentication)
- كلمات المرور مشفّرة بـ bcrypt (hash + salt).
- جلسات JWT عبر Auth.js مع انتهاء صلاحية.
- لا تخزين كلمات المرور في plaintext.

### 7.1 الصلاحيات (Authorization)
- **طبقة الخادم**: كل API Route و Server Action يتحقق من الدور قبل التنفيذ.
- **طبقة البيانات**: استعلامات Prisma تُفلتر حسب الدور (مثلاً: USER لا يرى Claims بـ DRAFT).
- **طبقة الواجهة**: إخفاء الأزرار غير المصرّح بها (تحسين تجربة فقط — ليس حماية).

### 7.3 التحقق من المدخلات
- كل مدخل يمرّ عبر Zod schema قبل المعالجة.
- لا ثقة في بيانات العميل.

### 7.4 الوصول الآمن للملفات
- الملفات لا تُقدّم من مجلد عام مباشرة.
- وصول عبر API Route تتحقق من الصلاحيات قبل الإرسال.

### 7.5 سجلات التدقيق (Audit Logs)
- كل عملية حساسة (اعتماد/رفض/تعديل/حذف/تغيير دور) تُسجّل:
  - من فعل، ماذا فعل، على أي كيان، القيمة السابقة، القيمة الجديدة، الوقت، السبب.

### 7.6 الخصوصية
- **بيانات عامة**: اسم العرض، الصورة، النبذة — تظهر للجميع.
- **بيانات خاصة**: البريد، إعدادات الخصوصية — لا تظهر للآخرين.
- **بيانات إدارية**: Audit Logs، بيانات المستخدمين الكاملة — ADMIN فقط.

---

## 8. خطة الاختبار (Testing Plan)

### 8.1 اختبارات PHASE 1 (بعد تنفيذ الأساس)

| الاختبار | الهدف |
|---|---|
| المصادقة | تسجيل/دخول/خروج يعمل، كلمة المرور مشفّرة |
| العزل بين الأدوار | USER لا يصل لـ /admin، CONTRIBUTOR لا يعتمد Claim |
| صلاحيات البيانات | USER لا يرى Claims بـ DRAFT |
| تخطيط Mobile | يعمل على 282px+، Bottom Nav يظهر |
| RTL | كل النصوص والاتجاه صحيح |
| علاقات قاعدة البيانات | Tribe→Branch، Family→Person تعمل |
| البحث الأساسي | يبحث في Tribes/Families/People/Sources/Posts |
| وصول Admin | /admin متاح لـ ADMIN فقط |
| وصول المستخدم | /dashboard متاح لأي مستخدم مسجّل |

### 8.2 استراتيجية الاختبار
- **يدوي عبر Preview**: تنفيذ سيناريوهات حقيقية (تسجيل، إنشاء، صلاحيات).
- **اختبارات الوحدة**: دوال التحقق والصلاحيات (Zod + authorization helpers).
- **اختبارات API**: استدعاء endpoints مع أدوار مختلفة والتأكد من الاستجابة.
- **اختبار RTL/Mobile**: فحص بصر عبر Preview على أبعاد مختلفة.

### 8.3 حالات الحافة (Edge Cases)
- Empty states (لا توجد قبائل بعد).
- Loading states.
- Error states (فشل الشبكة، خطأ الخادم).
- محتوى غير مؤكد لا يظهر كحقيقة.
- بحث بلا نتائج.

---

## 9. خطة التنفيذ المرحلية

| المرحلة | المحتوى | الحالة |
|---|---|---|
| **PHASE 0** | التحليل والتصميم (هذا التقرير) | ✅ مكتمل |
| **PHASE 1** | App shell, RTL, Auth, Profiles, Roles, Permissions, Core DB entities, Admin foundation, Home, Search | ⏳ بانتظار الموافقة |
| **PHASE 2** | Tribes, Families, Branches, People, Sources | |
| **PHASE 3** | Claims, Narratives, Conflicts, Verification, Review workflow | |
| **PHASE 4** | Documents, Uploads, Source management, Researcher dashboard | |
| **PHASE 5** | Majalis, Posts, Comments, Likes, Bookmarks, Reports, Moderation | |
| **PHASE 6** | Quality: Security, Permissions, Data integrity, Performance, Mobile, Error handling | |
| **PHASE 7** | Launch readiness: Production config, Monitoring, Security review | |

---

## 10. القرارات الهندسية المسجّلة

| # | القرار | السبب |
|---|---|---|
| 1 | Next.js Monolith (لا Microservices) | قاعدة #55: لا تعقيد غير ضروري |
| 2 | PostgreSQL + Prisma | علاقات معقدة + أمان أنواع |
| 3 | Role كـ enum على User (لا جدول منفصل) | بساطة + كفاية للمتطلبات |
| 4 | Permissions في طبقة الخادم (كود) لا في قاعدة البيانات | أوضح وأسهل في الصيانة |
| 5 | تخزين ملفات محلي + طبقة تجريد | قابلية ترقية لاحقة دون تغيير الكود |
| 6 | Auth.js (Credentials) | أصلي لـ Next.js، لا مصادقة خارجية (قاعدة #55) |
| 7 | MODERATOR لا يرث صلاحيات RESEARCHER | المواصفة: دوران مستقلان |
| 8 | لا AI / Chatbot في النسخة الأولى | قاعدة #40 |
| 9 | لا بيانات تاريخية تجريبية تظهر كحقيقية | القاعدة الذهبية #3 |

---

## 11. ما يحتاج موافقتك قبل PHASE 1

1. **هل توافق على البنية التقنية المقترحة؟** (Next.js + PostgreSQL + Prisma + Auth.js + TailwindCSS)
2. **هل توافق على نموذج البيانات والعلاقات؟**
3. **هل توافق على مصفوفة الصلاحيات كما هي؟**
4. **هل تبدأ PHASE 1 بعد موافقتك؟**

> في انتظار موافقتك. لا يُنفّذ أي كود حتى ذلك الحين.
