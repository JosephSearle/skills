# TypeORM Patterns for NestJS

**Authority:** docs.nestjs.com/techniques/database#typeorm-integration

---

## Module Setup

```typescript
// app.module.ts
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity.{js,ts}'],
        migrations: [__dirname + '/migrations/*.{js,ts}'],
        synchronize: configService.get('NODE_ENV') === 'test',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

---

## Data Mapper Pattern (Always Preferred Over Active Record)

**Why Data Mapper over Active Record:**
- Active Record: entity methods call the database (`user.save()`, `User.find()`) — couples ORM to business logic
- Data Mapper: repository is a separate class; entity is a plain data structure — testable without a database

```typescript
// user.entity.ts — plain data structure, no ORM methods
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  refreshToken: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

// users.repository.ts — data access layer
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  async save(user: Partial<User>): Promise<User> {
    return this.repo.save(user);
  }
}
```

Register in the feature module:

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
```

---

## Transactions

```typescript
// Option 1: DataSource.transaction() — recommended for simple cases
import { DataSource } from 'typeorm';

@Injectable()
export class OrdersService {
  constructor(private readonly dataSource: DataSource) {}

  async createOrder(dto: CreateOrderDto): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const order = manager.create(Order, { userId: dto.userId, total: dto.total });
      await manager.save(order);

      await manager.decrement(Inventory, { productId: dto.productId }, 'quantity', dto.quantity);

      return order;
    });
  }
}

// Option 2: QueryRunner — for fine-grained control or manual commit/rollback
async transferFunds(fromId: string, toId: string, amount: number): Promise<void> {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    await queryRunner.manager.decrement(Account, { id: fromId }, 'balance', amount);
    await queryRunner.manager.increment(Account, { id: toId }, 'balance', amount);
    await queryRunner.commitTransaction();
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}
```

---

## QueryBuilder for Complex Queries

Use QueryBuilder for queries that can't be expressed cleanly via the `find*` API:

```typescript
async findActiveUsersWithRecentOrders(days: number): Promise<User[]> {
  return this.dataSource
    .getRepository(User)
    .createQueryBuilder('user')
    .innerJoinAndSelect('user.orders', 'order')
    .where('user.isActive = :isActive', { isActive: true })
    .andWhere('order.createdAt > :since', {
      since: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    })
    .orderBy('user.createdAt', 'DESC')
    .getMany();
}
```

> ⚠️ **Gotcha:** Never use string interpolation in QueryBuilder. Use parameterized values (`:paramName`) to prevent SQL injection. `createQueryBuilder('user').where(\`user.id = '${userId}'\`)` is vulnerable.

---

## Migrations

```bash
# Generate migration from entity changes
npx typeorm migration:generate src/migrations/AddUserRefreshToken -d src/data-source.ts

# Review the generated file before committing

# Run in CI/CD
npx typeorm migration:run -d dist/data-source.js

# Rollback last migration
npx typeorm migration:revert -d dist/data-source.js
```

`data-source.ts` (required by TypeORM CLI):

```typescript
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
```

---

## Subscribers for Audit Trails

```typescript
import { EntitySubscriberInterface, EventSubscriber, UpdateEvent } from 'typeorm';

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  listenTo() { return User; }

  async afterUpdate(event: UpdateEvent<User>): Promise<void> {
    if (!event.entity) return;
    await event.manager.save(AuditLog, {
      entityId: event.entity.id,
      entityType: 'User',
      action: 'UPDATE',
      changes: event.updatedColumns.map((c) => c.propertyName),
      timestamp: new Date(),
    });
  }
}
```

Register in the TypeORM module config: `subscribers: [UserSubscriber]`.

---

## Unit Testing with getRepositoryToken

```typescript
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    mockRepo = module.get(getRepositoryToken(User));
  });

  it('throws NotFoundException when user not found', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
  });
});
```
