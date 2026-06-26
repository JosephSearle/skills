# Caching, Connection Pools, Fastify, Compression, Streaming

**Authority:** docs.nestjs.com/techniques/caching, docs.nestjs.com/techniques/performance

---

## @nestjs/cache-manager v6 (NestJS v11)

NestJS v11 uses `cache-manager` v6 which is Keyv-based. The store API has changed from v5.

```bash
npm install @nestjs/cache-manager cache-manager
npm install @keyv/redis  # Redis store for cache-manager v6
```

```typescript
// app.module.ts
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (configService: ConfigService) => ({
        stores: [
          new KeyvRedis(configService.get<string>('REDIS_URL')),
        ],
        ttl: 60 * 1000, // 60 seconds default TTL (ms in cache-manager v6)
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### CacheInterceptor for GET endpoints

```typescript
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@Controller('products')
@UseInterceptors(CacheInterceptor) // caches all GET responses in this controller
export class ProductsController {
  @Get()
  @CacheTTL(300_000) // override TTL: 5 minutes for product lists
  findAll() { ... }

  @Get(':id')
  @CacheTTL(60_000)
  findOne(@Param('id') id: string) { ... }
}
```

### Manual Cache Management

For more control — cache aside pattern:

```typescript
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findOne(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    const cached = await this.cacheManager.get<Product>(cacheKey);
    if (cached) return cached;

    const product = await this.productsRepository.findById(id);
    await this.cacheManager.set(cacheKey, product, 60_000); // 60s TTL
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productsRepository.update(id, dto);
    await this.cacheManager.del(`product:${id}`); // invalidate on write
    return product;
  }
}
```

---

## DB Connection Pool Tuning

Default connection pool sizes are often too conservative for production load.

### Prisma

```
// .env or DATABASE_URL query param
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
```

Rule of thumb: `connection_limit = (cpu_cores * 2) + effective_spindle_count`

For most cloud Postgres: `connection_limit = num_instance_cpu * 2`

### TypeORM

```typescript
TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    extra: {
      max: 20,        // max connections per pool
      min: 5,         // min idle connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    },
  }),
})
```

---

## Fastify Adapter Decision

> 💡 **Senior insight:** Fastify's 2–3x throughput advantage is real on benchmarks, but most production APIs are bottlenecked by the database, not the HTTP framework. Before switching:
>
> 1. Run `k6` load test and identify where time is spent
> 2. If DB queries account for >80% of response time → Fastify won't help
> 3. Only switch if profiling shows framework overhead as the constraint

```typescript
// Install if you've validated the switch is warranted:
// npm install @nestjs/platform-fastify @fastify/compress

import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';

const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter({ logger: false }), // disable Fastify logger — use nestjs-pino
);
```

---

## Response Compression

```bash
npm install compression         # Express adapter
# OR
npm install @fastify/compress   # Fastify adapter
```

```typescript
// Express adapter (app.module.ts or main.ts)
import * as compression from 'compression';
app.use(compression());

// Fastify adapter
await app.register(require('@fastify/compress'), { encodings: ['gzip', 'br'] });
```

---

## Lazy-Loading Modules

For large apps or serverless cold-start sensitivity, load non-critical modules on first use:

```typescript
import { LazyModuleLoader } from '@nestjs/core';

@Injectable()
export class CsvExportService {
  constructor(private readonly lazyModuleLoader: LazyModuleLoader) {}

  async exportToCsv(filters: ExportFilters): Promise<Buffer> {
    // Only load the heavy CSV module when first requested
    const { CsvGeneratorModule } = await import('./csv-generator/csv-generator.module');
    const moduleRef = await this.lazyModuleLoader.load(() => CsvGeneratorModule);
    const csvGenerator = moduleRef.get(CsvGeneratorService);
    return csvGenerator.generate(filters);
  }
}
```

---

## Streaming Large Responses

Use `StreamableFile` to stream large responses instead of buffering the entire payload:

```typescript
import { Controller, Get, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { join } from 'path';

@Get('export')
async export(@Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
  response.setHeader('Content-Type', 'text/csv');
  response.setHeader('Content-Disposition', 'attachment; filename="export.csv"');

  const stream = createReadStream(join(process.cwd(), 'export.csv'));
  return new StreamableFile(stream);
}
```

For dynamically generated streams (Prisma cursor-based export):

```typescript
import { Readable } from 'stream';

@Get('export')
async exportLargeDataset(): Promise<StreamableFile> {
  const readable = new Readable({ objectMode: false, read() {} });

  // Async generator that writes CSV chunks
  (async () => {
    readable.push('id,email,createdAt\n');
    for await (const batch of this.usersRepository.cursor({ batchSize: 500 })) {
      readable.push(batch.map((u) => `${u.id},${u.email},${u.createdAt}`).join('\n'));
      readable.push('\n');
    }
    readable.push(null); // signal end of stream
  })();

  return new StreamableFile(readable, { type: 'text/csv' });
}
```
