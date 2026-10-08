# مجالس العرب — المرحلة الأولى

واجهة عربية RTL لبناء سجل بحثي موثق للكيانات والعلاقات والمصادر والأدلة. المبدأ الأساسي: لا تُضاف روايات أو أنساب مختلقة، ولا يُوصف أي ادعاء بأنه مثبت دون مصدر وأدلة ومراجعة بشرية.

## الحالة الحالية

هذه مرحلة تأسيسية وليست منصة مكتملة. تتضمن:
- واجهة عربية متجاوبة تقرأ العدادات من قاعدة البيانات.
- مخطط SQLite عبر Prisma للنماذج البحثية الأساسية.
- API لإنشاء الكيانات والتحقق من المدخلات والبحث/الاستعراض.
- حالات منفصلة للمصدر، واستخراج النص، ومراجعة الأدلة، والادعاءات المتعارضة.
- لا توجد بيانات قبلية تجريبية أو نتائج ثابتة مزيفة.

## التشغيل محليًا

1. ثبّت Node.js 20 أو أحدث.
2. انسخ `.env.example` إلى `.env`.
3. ثبّت الاعتماديات: `npm install`.
4. أنشئ قاعدة البيانات ومخططها: `npx prisma migrate dev --name init`.
5. شغّل التطبيق: `npm run dev`.

## نقاط لم تُنجز بعد

- صفحات إدارة CRUD كاملة للمصادر والمقاطع والادعاءات والأماكن وطلبات الإضافة.
- تسجيل الدخول والأدوار. يوجد نموذج سجل تدقيق وتُسجل فيه عملية إنشاء الكيان، لكن يلزم توسيع التغطية لبقية العمليات.
- اختبارات وحدة أولية للتحقق من المدخلات وتطبيع الأسماء؛ اختبارات تكامل فعلية للقاعدة وواجهات API لم تُشغّل بعد.
- تدقيق قانونية الوصول للمصادر وحقوق النصوص قبل استيرادها.
- مراجعة بشرية لأي ادعاء يراد نقله إلى حالة `SUPPORTED`.

لا تعتبر هذه المرحلة جاهزة للإنتاج أو آمنة لبيانات متعددة المستخدمين؛ لا يوجد حتى الآن نظام مصادقة أو صلاحيات على مستوى المستخدم.


## Security release gate (important)

The application currently has no authentication, authorization, or per-user/workspace data isolation. Therefore, **it is not safe to deploy as a public production application**.

A temporary production middleware gate now returns HTTP 503 for application routes until the missing security controls are implemented and reviewed. Local development remains available. Do not remove this gate just to make a deployment appear live.

Security controls added in this branch:
- Common HTTP security headers (content-type sniffing, framing, referrer policy, permissions policy, and cross-origin opener policy).
- Production fail-closed gate while authentication and data isolation are absent.
- Audit-log model and an audit record for entity creation only.

Release blockers still open:
- Authentication and secure session lifecycle.
- Authorization checks on every page and API route.
- Workspace/tenant ownership on every private record and database query.
- CSRF/origin protections for state-changing requests once cookie sessions are added.
- Durable rate limiting and abuse protection.
- Backup/restore and encryption-at-rest strategy appropriate to the hosting platform.
- Security test coverage, dependency audit, and external penetration test before launch.

No claim of being "unhackable" or production-ready is made. Remove the production gate only after the blockers are addressed and tests pass.


## Security tests added

- Bounded JSON parsing rejects non-JSON content types, malformed JSON, and bodies exceeding the configured byte limit.
- Entity API responses are marked no-store, search input length is bounded, returned entity fields are minimized, and server errors do not expose exception details to clients.
- External source links accept only HTTP(S) URLs and reject script schemes or embedded credentials.
- Unit tests cover the release gate and these input-validation rules. These tests are authored but **have not yet been executed in a runtime**.
