import { prisma } from "@/lib/db";
import { EntityType, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  TRIBE: "قبيلة",
  FAMILY: "عائلة",
  BRANCH: "فرع",
  PERSON: "شخصية",
  REGION: "منطقة",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const type = params.type ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  type SearchResult = Prisma.EntityGetPayload<{
    select: {
      id: true;
      entityType: true;
      name: true;
      description: true;
      status: true;
    };
  }>;

  let results: SearchResult[] = [];
  let total = 0;

  if (query || type) {
    const where: Record<string, unknown> = { status: "PUBLISHED" };
    if (type && Object.values(EntityType).includes(type as EntityType)) {
      where.entityType = type;
    }
    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { normalizedName: { contains: query, mode: "insensitive" } },
        { aliases: { has: query } },
      ];
    }

    [results, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
        select: {
          id: true,
          entityType: true,
          name: true,
          description: true,
          status: true,
        },
      }),
      prisma.entity.count({ where }),
    ]);
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* البحث */}
      <form action="/search" className="flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="ابحث عن قبيلة، عائلة، شخصية..."
          className="input-field"
          autoComplete="off"
        />
        <button type="submit" className="btn-primary shrink-0">بحث</button>
      </form>

      {/* فلتر النوع */}
      <div className="flex flex-wrap gap-2">
        <a href={`/search?q=${encodeURIComponent(query)}`} className={`btn-secondary text-sm ${!type ? "ring-2 ring-brand-500" : ""}`}>
          الكل
        </a>
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <a
            key={key}
            href={`/search?q=${encodeURIComponent(query)}&type=${key}`}
            className={`btn-secondary text-sm ${type === key ? "ring-2 ring-brand-500" : ""}`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* النتائج */}
      <div className="space-y-3">
        {query || type ? (
          results.length === 0 ? (
            <div className="card text-center py-8 text-brand-400">
              <p className="text-sm">لا توجد نتائج</p>
              <p className="text-xs mt-1 text-brand-300">
                المحتوى المعتمد يظهر هنا بعد المراجعة
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-brand-500">{total} نتيجة</p>
              {results.map((item) => (
                <div key={item.id} className="card space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-brand-100 text-brand-600 px-2 py-0.5 rounded-md">
                      {TYPE_LABELS[item.entityType] ?? item.entityType}
                    </span>
                    <h3 className="font-medium text-brand-800">{item.name}</h3>
                  </div>
                  {item.description && (
                    <p className="text-sm text-brand-500 line-clamp-2">{item.description}</p>
                  )}
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  {page > 1 && (
                    <a href={`/search?q=${encodeURIComponent(query)}&type=${type}&page=${page - 1}`} className="btn-secondary text-sm">
                      السابق
                    </a>
                  )}
                  <span className="px-3 py-2 text-sm text-brand-500">
                    {page} / {totalPages}
                  </span>
                  {page < totalPages && (
                    <a href={`/search?q=${encodeURIComponent(query)}&type=${type}&page=${page + 1}`} className="btn-secondary text-sm">
                      التالي
                    </a>
                  )}
                </div>
              )}
            </>
          )
        ) : (
          <div className="card text-center py-8 text-brand-400">
            <p className="text-sm">ابحث في القبائل والعائلات والشخصيات والمصادر</p>
          </div>
        )}
      </div>
    </div>
  );
}
