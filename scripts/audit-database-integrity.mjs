import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar");
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function warning(code, severity, message, count, examples = []) {
  return { code, severity, message, count, examples: examples.slice(0, 10) };
}

/**
 * Read-only consistency checks over records loaded from Prisma.
 * A warning indicates a structural or review issue; it does not prove
 * whether a historical statement is true.
 */
export function buildDatabaseIntegrityReport(data) {
  const {
    entities = [], relationships = [], sources = [], passages = [], claims = [],
    places = [], workspaces = [], workspaceTribes = [], users = [],
    workspaceMembers = [], additionRequests = [], auditLogs = [],
    posts = [], comments = [], reactions = []
  } = data;

  const ids = items => new Set(items.map(item => item.id));
  const entityIds = ids(entities);
  const sourceIds = ids(sources);
  const passageIds = ids(passages);
  const claimIds = ids(claims);
  const workspaceIds = ids(workspaces);
  const userIds = ids(users);
  const postIds = ids(posts);
  const warnings = [];

  const mismatchedNames = entities.filter(entity =>
    !entity.name?.trim() || normalizeName(entity.name) !== entity.normalizedName
  );
  if (mismatchedNames.length) warnings.push(warning(
    "ENTITY_NORMALIZED_NAME_MISMATCH", "high",
    "اسم الكيان لا يطابق القيمة المعيارية المخزنة أو أن الاسم فارغ.", mismatchedNames.length,
    mismatchedNames.map(item => ({ id: item.id, name: item.name, normalizedName: item.normalizedName }))
  ));

  const duplicateNames = [...groupBy(entities, item => item.normalizedName).entries()]
    .filter(([key, items]) => key && items.length > 1);
  if (duplicateNames.length) warnings.push(warning(
    "DUPLICATE_NORMALIZED_ENTITY_NAME", "high",
    "توجد كيانات تتشارك الاسم المعياري؛ لا تدمجها تلقائيًا.", duplicateNames.length,
    duplicateNames.map(([normalizedName, items]) => ({ normalizedName, ids: items.map(item => item.id), names: items.map(item => item.name) }))
  ));

  const invalidRelationships = relationships.filter(item =>
    !entityIds.has(item.fromEntityId) || !entityIds.has(item.toEntityId) ||
    (item.claimId && !claimIds.has(item.claimId))
  );
  if (invalidRelationships.length) warnings.push(warning(
    "BROKEN_RELATIONSHIP_REFERENCE", "critical",
    "علاقة تشير إلى كيان أو ادعاء غير موجود.", invalidRelationships.length,
    invalidRelationships.map(item => ({ id: item.id, fromEntityId: item.fromEntityId, toEntityId: item.toEntityId, claimId: item.claimId }))
  ));

  const selfRelationships = relationships.filter(item => item.fromEntityId === item.toEntityId);
  if (selfRelationships.length) warnings.push(warning(
    "SELF_RELATIONSHIP", "high",
    "العلاقة تربط الكيان بنفسه؛ تحتاج مراجعة ولا تُحذف آليًا.", selfRelationships.length,
    selfRelationships.map(item => ({ id: item.id, entityId: item.fromEntityId, relationshipType: item.relationshipType }))
  ));

  const duplicateRelationships = [...groupBy(relationships, item =>
    [item.fromEntityId, item.toEntityId, item.relationshipType, item.claimId ?? ""].join("|")
  ).entries()].filter(([, items]) => items.length > 1);
  if (duplicateRelationships.length) warnings.push(warning(
    "DUPLICATE_RELATIONSHIP_CANDIDATE", "medium",
    "توجد علاقات متكررة محتملة؛ قد تكون مقصودة ولا تُدمج آليًا.", duplicateRelationships.length,
    duplicateRelationships.map(([key, items]) => ({ key, ids: items.map(item => item.id) }))
  ));

  const brokenPassages = passages.filter(item =>
    !sourceIds.has(item.sourceId) || (item.entityId && !entityIds.has(item.entityId))
  );
  if (brokenPassages.length) warnings.push(warning(
    "BROKEN_EVIDENCE_REFERENCE", "critical",
    "مقطع دليل يشير إلى مصدر أو كيان غير موجود.", brokenPassages.length,
    brokenPassages.map(item => ({ id: item.id, sourceId: item.sourceId, entityId: item.entityId }))
  ));

  const emptyPassages = passages.filter(item => !String(item.passageText ?? "").trim());
  if (emptyPassages.length) warnings.push(warning(
    "EMPTY_EVIDENCE_PASSAGE", "medium",
    "مقاطع دليل فارغة لا يمكن الاستشهاد بمحتواها.", emptyPassages.length,
    emptyPassages.map(item => ({ id: item.id, sourceId: item.sourceId }))
  ));

  const brokenClaims = claims.filter(item =>
    (item.sourceId && !sourceIds.has(item.sourceId)) ||
    (item.entityId && !entityIds.has(item.entityId)) ||
    (item.supportingPassageIds ?? []).some(id => !passageIds.has(id)) ||
    (item.contradictingPassageIds ?? []).some(id => !passageIds.has(id))
  );
  if (brokenClaims.length) warnings.push(warning(
    "BROKEN_HISTORICAL_CLAIM_REFERENCE", "critical",
    "ادعاء تاريخي يشير إلى مصدر أو كيان أو مقطع غير موجود.", brokenClaims.length,
    brokenClaims.map(item => ({ id: item.id, sourceId: item.sourceId, entityId: item.entityId }))
  ));

  const knownClaimStatuses = new Set(["UNREVIEWED", "SUPPORTED", "CONTRADICTED", "DISPUTED", "REJECTED", "NEEDS_REVIEW"]);
  const unknownClaimStatuses = claims.filter(item => !knownClaimStatuses.has(item.status));
  if (unknownClaimStatuses.length) warnings.push(warning(
    "UNKNOWN_CLAIM_STATUS", "high",
    "توجد حالات ادعاءات غير معروفة؛ لا ينبغي اعتبارها موثقة تلقائيًا.", unknownClaimStatuses.length,
    unknownClaimStatuses.map(item => ({ id: item.id, status: item.status }))
  ));

  const claimsWithoutEvidence = claims.filter(item =>
    !item.sourceId && !(item.supportingPassageIds ?? []).length
  );
  if (claimsWithoutEvidence.length) warnings.push(warning(
    "CLAIM_WITHOUT_LINKED_EVIDENCE", "medium",
    "ادعاءات بلا مصدر أو مقطع مساند مرتبط؛ يجب عرضها كغير موثقة.", claimsWithoutEvidence.length,
    claimsWithoutEvidence.map(item => ({ id: item.id, statement: String(item.statement ?? "").slice(0, 100), status: item.status }))
  ));

  const invalidPlaces = places.filter(item =>
    (item.latitude != null && (item.latitude < -90 || item.latitude > 90)) ||
    (item.longitude != null && (item.longitude < -180 || item.longitude > 180)) ||
    ((item.latitude == null) !== (item.longitude == null))
  );
  if (invalidPlaces.length) warnings.push(warning(
    "INVALID_PLACE_COORDINATES", "high",
    "إحداثيات المكان خارج النطاق أو أن خط العرض/الطول غير مكتمل.", invalidPlaces.length,
    invalidPlaces.map(item => ({ id: item.id, name: item.name, latitude: item.latitude, longitude: item.longitude }))
  ));

  const brokenPlaces = places.filter(item =>
    (item.entityId && !entityIds.has(item.entityId)) ||
    (item.sourceId && !sourceIds.has(item.sourceId)) ||
    (item.evidencePassageId && !passageIds.has(item.evidencePassageId))
  );
  if (brokenPlaces.length) warnings.push(warning(
    "BROKEN_PLACE_REFERENCE", "critical",
    "مكان يشير إلى كيان أو مصدر أو مقطع غير موجود.", brokenPlaces.length,
    brokenPlaces.map(item => ({ id: item.id, entityId: item.entityId, sourceId: item.sourceId, evidencePassageId: item.evidencePassageId }))
  ));

  const brokenWorkspaceTribes = workspaceTribes.filter(item =>
    !workspaceIds.has(item.workspaceId) || !entityIds.has(item.entityId)
  );
  if (brokenWorkspaceTribes.length) warnings.push(warning(
    "BROKEN_WORKSPACE_TRIBE_LINK", "critical",
    "ربط مجلس بقبيلة يشير إلى سجل غير موجود.", brokenWorkspaceTribes.length,
    brokenWorkspaceTribes.map(item => ({ workspaceId: item.workspaceId, entityId: item.entityId }))
  ));

  const brokenMembers = workspaceMembers.filter(item =>
    !workspaceIds.has(item.workspaceId) || !userIds.has(item.userId)
  );
  if (brokenMembers.length) warnings.push(warning(
    "BROKEN_WORKSPACE_MEMBERSHIP", "critical",
    "عضوية تشير إلى مستخدم أو مجلس غير موجود.", brokenMembers.length,
    brokenMembers.map(item => ({ id: item.id, workspaceId: item.workspaceId, userId: item.userId }))
  ));

  const membershipPairs = [...groupBy(workspaceMembers, item => item.workspaceId + "|" + item.userId).entries()]
    .filter(([, items]) => items.length > 1);
  if (membershipPairs.length) warnings.push(warning(
    "DUPLICATE_WORKSPACE_MEMBERSHIP", "high",
    "هناك أكثر من عضوية للمستخدم نفسه في المجلس نفسه.", membershipPairs.length,
    membershipPairs.map(([key, items]) => ({ key, ids: items.map(item => item.id) }))
  ));

  const brokenRequests = additionRequests.filter(item =>
    !workspaceIds.has(item.workspaceId) ||
    (item.userId && !userIds.has(item.userId)) ||
    (item.entityId && !entityIds.has(item.entityId))
  );
  if (brokenRequests.length) warnings.push(warning(
    "BROKEN_ADDITION_REQUEST_REFERENCE", "critical",
    "طلب إضافة يشير إلى مستخدم أو مجلس أو كيان غير موجود.", brokenRequests.length,
    brokenRequests.map(item => ({ id: item.id, workspaceId: item.workspaceId, userId: item.userId, entityId: item.entityId }))
  ));

  const brokenAuditLogs = auditLogs.filter(item =>
    !workspaceIds.has(item.workspaceId) || (item.actorUserId && !userIds.has(item.actorUserId))
  );
  if (brokenAuditLogs.length) warnings.push(warning(
    "BROKEN_AUDIT_LOG_REFERENCE", "critical",
    "سجل تدقيق يشير إلى مجلس أو مستخدم غير موجود.", brokenAuditLogs.length,
    brokenAuditLogs.map(item => ({ id: item.id, workspaceId: item.workspaceId, actorUserId: item.actorUserId }))
  ));

  const brokenPosts = posts.filter(item => !workspaceIds.has(item.workspaceId) || !userIds.has(item.authorId));
  if (brokenPosts.length) warnings.push(warning(
    "BROKEN_COUNCIL_POST_REFERENCE", "critical",
    "منشور يشير إلى مجلس أو كاتب غير موجود.", brokenPosts.length,
    brokenPosts.map(item => ({ id: item.id, workspaceId: item.workspaceId, authorId: item.authorId }))
  ));

  const postById = new Map(posts.map(item => [item.id, item]));
  const memberPairs = new Set(workspaceMembers.map(item => item.workspaceId + "|" + item.userId));
  const brokenComments = comments.filter(item => {
    const post = postById.get(item.postId);
    return !post || !userIds.has(item.authorId) || !memberPairs.has(post.workspaceId + "|" + item.authorId);
  });
  if (brokenComments.length) warnings.push(warning(
    "COMMENT_AUTHOR_NOT_IN_POST_WORKSPACE", "high",
    "تعليق يشير إلى منشور مفقود أو كاتب ليس عضوًا في مجلس المنشور.", brokenComments.length,
    brokenComments.map(item => ({ id: item.id, postId: item.postId, authorId: item.authorId }))
  ));

  const brokenReactions = reactions.filter(item => {
    const post = postById.get(item.postId);
    return !post || !userIds.has(item.userId) || !memberPairs.has(post.workspaceId + "|" + item.userId);
  });
  if (brokenReactions.length) warnings.push(warning(
    "REACTION_USER_NOT_IN_POST_WORKSPACE", "high",
    "تفاعل يشير إلى منشور مفقود أو مستخدم ليس عضوًا في مجلس المنشور.", brokenReactions.length,
    brokenReactions.map(item => ({ id: item.id, postId: item.postId, userId: item.userId }))
  ));

  const criticalCount = warnings.filter(item => item.severity === "critical").reduce((sum, item) => sum + item.count, 0);
  const highCount = warnings.filter(item => item.severity === "high").reduce((sum, item) => sum + item.count, 0);
  const mediumCount = warnings.filter(item => item.severity === "medium").reduce((sum, item) => sum + item.count, 0);

  return {
    generatedAt: new Date().toISOString(),
    mode: "READ_ONLY",
    totals: {
      entities: entities.length, relationships: relationships.length, sources: sources.length,
      evidencePassages: passages.length, historicalClaims: claims.length, places: places.length,
      workspaces: workspaces.length, workspaceTribeLinks: workspaceTribes.length, users: users.length,
      workspaceMembers: workspaceMembers.length, additionRequests: additionRequests.length,
      auditLogs: auditLogs.length, councilPosts: posts.length, councilComments: comments.length,
      councilReactions: reactions.length
    },
    summary: { criticalCount, highCount, mediumCount, warningGroups: warnings.length },
    warnings,
    limitations: [
      "الفحص لا يغير أو يحذف أو يدمج أي سجل.",
      "سلامة الروابط والبنية لا تثبت صحة الأنساب أو الروايات التاريخية.",
      "العلاقات المكررة والأسماء المتشابهة مرشحات للمراجعة البشرية وليست أوامر دمج.",
      "الحقيقة التاريخية تحتاج مصادر قابلة للتحقق ومراجعة بشرية."
    ]
  };
}

async function main() {
  const startedAt = Date.now();
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const authUrl = process.env.BETTER_AUTH_URL ?? "";
  const production = process.env.NODE_ENV === "production";
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER &&
    process.env.SMTP_PASS && process.env.MAIL_FROM && process.env.SMTP_PORT
  );

  const report = {
    generatedAt: new Date().toISOString(),
    database: {
      configured: Boolean(databaseUrl),
      provider: databaseUrl.startsWith("file:") ? "sqlite" : databaseUrl ? "other" : "missing",
      connected: false,
      integrityCheck: "NOT_RUN",
      foreignKeyViolations: [],
      error: null
    },
    authentication: {
      environment: process.env.NODE_ENV ?? "not-set",
      betterAuthSecretConfigured: Boolean(process.env.BETTER_AUTH_SECRET),
      betterAuthSecretLengthValid: Boolean(process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 32),
      betterAuthUrlConfigured: Boolean(authUrl),
      betterAuthUrlValid: false,
      trustedOriginCount: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",").map(item => item.trim()).filter(Boolean).length,
      smtpConfigured,
      googleOAuthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      codespacesEnvironment: Boolean(process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN),
      rateLimitSummary: { totalRecords: 0, signInRecords: 0, signUpRecords: 0, passwordResetRecords: 0, highestObservedCount: 0 },
      accountCounts: { users: 0, sessions: 0, accounts: 0 }
    },
    dataIntegrity: null,
    elapsedMs: null
  };

  try {
    if (!databaseUrl) throw new Error("DATABASE_URL is missing.");
    await prisma.$queryRawUnsafe("SELECT 1");
    report.database.connected = true;
    const [rateLimitRows, userCount, sessionCount, accountCount] = await Promise.all([
      prisma.rateLimit.findMany({ select: { key: true, count: true } }),
      prisma.user.count(),
      prisma.session.count(),
      prisma.account.count()
    ]);
    report.authentication.rateLimitSummary = {
      totalRecords: rateLimitRows.length,
      signInRecords: rateLimitRows.filter(row => /sign[-_/]?in/i.test(row.key)).length,
      signUpRecords: rateLimitRows.filter(row => /sign[-_/]?up/i.test(row.key)).length,
      passwordResetRecords: rateLimitRows.filter(row => /reset|password/i.test(row.key)).length,
      highestObservedCount: rateLimitRows.reduce((max, row) => Math.max(max, row.count), 0)
    };
    report.authentication.accountCounts = { users: userCount, sessions: sessionCount, accounts: accountCount };
    const integrityRows = await prisma.$queryRawUnsafe("PRAGMA integrity_check");
    report.database.integrityCheck = integrityRows?.[0]?.integrity_check ?? "UNKNOWN";
    report.database.foreignKeyViolations = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");

    const [
      entities, relationships, sources, passages, claims, places, workspaces, workspaceTribes,
      users, workspaceMembers, additionRequests, auditLogs, posts, comments, reactions
    ] = await Promise.all([
      prisma.tribalEntity.findMany({ select: { id: true, name: true, normalizedName: true } }),
      prisma.relationship.findMany({ select: { id: true, fromEntityId: true, toEntityId: true, relationshipType: true, claimId: true } }),
      prisma.source.findMany({ select: { id: true } }),
      prisma.evidencePassage.findMany({ select: { id: true, sourceId: true, entityId: true, passageText: true } }),
      prisma.historicalClaim.findMany({
        select: {
          id: true, statement: true, sourceId: true, entityId: true, status: true,
          supportingPassages: { select: { id: true } },
          contradictingPassages: { select: { id: true } }
        }
      }),
      prisma.place.findMany({ select: { id: true, name: true, latitude: true, longitude: true, sourceId: true, evidencePassageId: true, entityId: true } }),
      prisma.workspace.findMany({ select: { id: true } }),
      prisma.workspaceTribe.findMany({ select: { workspaceId: true, entityId: true } }),
      prisma.user.findMany({ select: { id: true } }),
      prisma.workspaceMember.findMany({ select: { id: true, workspaceId: true, userId: true } }),
      prisma.additionRequest.findMany({ select: { id: true, workspaceId: true, userId: true, entityId: true } }),
      prisma.auditLog.findMany({ select: { id: true, workspaceId: true, actorUserId: true } }),
      prisma.councilPost.findMany({ select: { id: true, workspaceId: true, authorId: true } }),
      prisma.councilComment.findMany({ select: { id: true, postId: true, authorId: true } }),
      prisma.councilReaction.findMany({ select: { id: true, postId: true, userId: true } })
    ]);

    report.dataIntegrity = buildDatabaseIntegrityReport({
      entities, relationships, sources,
      passages: passages.map(({ reviewedByHuman, ...item }) => item),
      claims: claims.map(({ supportingPassages, contradictingPassages, ...item }) => ({
        ...item,
        supportingPassageIds: supportingPassages.map(passage => passage.id),
        contradictingPassageIds: contradictingPassages.map(passage => passage.id)
      })),
      places, workspaces, workspaceTribes, users, workspaceMembers,
      additionRequests, auditLogs, posts, comments, reactions
    });
  } catch (error) {
    report.database.error = error instanceof Error ? error.message : "Unknown database diagnostic failure";
  }

  try {
    const parsedUrl = new URL(authUrl);
    report.authentication.betterAuthUrlValid = parsedUrl.protocol === "https:" ||
      (!production && parsedUrl.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsedUrl.hostname));
  } catch {
    report.authentication.betterAuthUrlValid = false;
  }

  report.elapsedMs = Date.now() - startedAt;
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");

  const dbFailed = !report.database.connected || report.database.integrityCheck !== "ok" ||
    report.database.foreignKeyViolations.length > 0;
  const authConfigFailed = production && (
    !report.authentication.betterAuthSecretLengthValid ||
    !report.authentication.betterAuthUrlValid ||
    !report.authentication.smtpConfigured
  );
  if (dbFailed || authConfigFailed || report.database.error) process.exitCode = 1;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().finally(async () => prisma.$disconnect());
}
