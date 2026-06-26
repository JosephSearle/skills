# Pagination, Filtering, and Sorting

**Authority:** docs.nestjs.com/techniques/database

---

## Cursor vs Offset Pagination Decision

| Factor | Cursor/Keyset | Offset (LIMIT/OFFSET) |
|--------|--------------|----------------------|
| Performance at depth | Excellent — O(1) regardless of page | Degrades badly — page 10k of 10M rows ≈ 8s on PostgreSQL |
| Stability under writes | Stable — no "page drift" when rows inserted/deleted | Unstable — inserts/deletes shift rows between pages |
| Random page access | No | Yes |
| Total count | No (expensive for cursor) | Yes (cheap COUNT(*)) |
| Best for | Large/growing datasets, APIs, infinite scroll | Small/static datasets, admin UIs with page numbers |

> 💡 **Senior insight:** The 17x speedup figure for cursor pagination is real — it comes from converting `OFFSET N` (which scans and discards N rows) to a `WHERE (created_at, id) < (?, ?)` condition (which uses the index directly). On a 1M+ row PostgreSQL table, offset pagination at page 100+ is measurably slow in production.

> ⚠️ **Caveat:** Benchmark figures are directional — they vary by dataset size, index quality, and hardware. Always measure in your specific environment rather than relying on published numbers.

**Rule of thumb:**
- Collections likely to exceed 100k rows → use cursor pagination
- Collections that need random page access or total counts → use offset pagination
- Public APIs and feeds → cursor pagination (more stable under concurrent writes)

---

## Cursor Pagination Implementation

```typescript
// cursor-pagination.dto.ts
export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string; // base64-encoded { createdAt, id }

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

// users.repository.ts
async findWithCursor(dto: CursorPaginationDto): Promise<{
  items: User[];
  nextCursor: string | null;
}> {
  const limit = dto.limit + 1; // fetch one extra to determine if there's a next page

  let createdAtCursor: Date | undefined;
  let idCursor: string | undefined;

  if (dto.cursor) {
    const decoded = JSON.parse(Buffer.from(dto.cursor, 'base64').toString('utf8'));
    createdAtCursor = new Date(decoded.createdAt);
    idCursor = decoded.id;
  }

  // Keyset pagination: WHERE (created_at, id) < (cursor_created_at, cursor_id)
  const users = await this.prisma.user.findMany({
    where: createdAtCursor && idCursor
      ? {
          OR: [
            { createdAt: { lt: createdAtCursor } },
            { createdAt: createdAtCursor, id: { lt: idCursor } },
          ],
        }
      : undefined,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });

  const hasNextPage = users.length > dto.limit;
  const items = hasNextPage ? users.slice(0, -1) : users;

  const nextCursor = hasNextPage && items.length > 0
    ? Buffer.from(
        JSON.stringify({
          createdAt: items[items.length - 1].createdAt,
          id: items[items.length - 1].id,
        }),
      ).toString('base64')
    : null;

  return { items, nextCursor };
}
```

Response envelope:

```typescript
// Standard pagination envelope
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    limit: number;
    count: number;
  };
}
```

---

## Offset Pagination

```typescript
export class OffsetPaginationDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

// For admin UIs that need total counts:
const [items, total] = await this.prisma.$transaction([
  this.prisma.user.findMany({ skip: offset, take: limit }),
  this.prisma.user.count(),
]);
```

---

## Filtering and Sorting — Whitelist Required

> ⚠️ **Gotcha:** Never pass arbitrary user-supplied field names directly to the ORM query. A user sending `?sortBy=password` or `?filter[internalFlag]=true` can trigger unindexed scans on sensitive fields or expose internal data.

```typescript
// WRONG — arbitrary field names passed to ORM
const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'name', 'email']);

// query param: ?sortBy=password — bypasses the check because we forgot to validate
const users = await this.prisma.user.findMany({ orderBy: { [sortBy]: 'asc' } });

// CORRECT — explicit whitelist
const ALLOWED_SORT_FIELDS = new Set<keyof User>(['createdAt', 'name', 'email']);

export class UsersFilterDto {
  @IsOptional()
  @IsIn(['createdAt', 'name', 'email'])
  sortBy?: 'createdAt' | 'name' | 'email';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string; // search only in allowed fields
}
```
