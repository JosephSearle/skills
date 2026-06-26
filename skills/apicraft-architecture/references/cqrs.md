# CQRS in NestJS

**Authority:** docs.nestjs.com/recipes/cqrs

---

## CQRS Decision Tree

```
Is your read model meaningfully different from your write model?
  └─ No → Don't use CQRS. A service with read/write methods is simpler.

Is your team experienced with DDD concepts (aggregates, domain events)?
  └─ No → Don't use CQRS. Onboarding cost outweighs benefits below ~50 engineers.

Do you have >~10k req/day AND read/write performance requirements that diverge?
  └─ No → Don't use CQRS. Standard service layer handles this fine.

  └─ Yes to all three → CQRS is worth evaluating.
      ├─ Do you need an audit trail or time-travel queries?
      │   └─ Yes → Consider CQRS + Event Sourcing (with awareness of the added complexity)
      │   └─ No → CQRS without Event Sourcing (the pragmatic default)
      └─ Just separating reads and writes?
          └─ CQRS without Event Sourcing — separate command/query handlers, shared DB
```

> 💡 **Senior insight:** CQRS adds boilerplate: a `Command` class, a `CommandHandler`, an `ICommandBus` injection, and a `@CommandHandler` registration — for every operation. For a typical 10-endpoint CRUD API, this is 5× the code for no architectural gain. Adopt CQRS only when the read and write models genuinely diverge — different DTOs, different query patterns, different caching strategies.

---

## CQRS Without Event Sourcing (Pragmatic Default)

```bash
npm install @nestjs/cqrs
```

```typescript
// app.module.ts
import { CqrsModule } from '@nestjs/cqrs';

@Module({
  imports: [CqrsModule],
})
export class AppModule {}
```

### Command

```typescript
// create-user.command.ts
export class CreateUserCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}

// create-user.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(private readonly usersRepository: UsersRepository) {}

  async execute(command: CreateUserCommand): Promise<User> {
    return this.usersRepository.create({
      email: command.email,
      password: await bcrypt.hash(command.password, 12),
    });
  }
}
```

### Controller dispatches via CommandBus

```typescript
@Post()
async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
  const user = await this.commandBus.execute(
    new CreateUserCommand(dto.email, dto.password),
  );
  return new UserResponseDto(user);
}
```

---

## Event Sourcing — When Not to Use It

Event Sourcing stores state as a sequence of events rather than the current state. It's powerful for audit trails and time-travel but carries serious costs:

| Cost | Description |
|------|-------------|
| Schema evolution pain | Changing an event's shape requires migrating all historical events |
| Projection rebuild complexity | Adding a new read model requires replaying the entire event store |
| Eventual consistency | Read models are eventually consistent — queries may return stale data |
| Tooling immaturity | NestJS CQRS event sourcing lacks production-grade tooling (EventStoreDB integration is manual) |

**Use Event Sourcing only when:** you have a genuine audit trail requirement (financial ledger, compliance logging), and you have a team that has operated an event-sourced system before.

For audit trails without Event Sourcing: use a dedicated `audit_log` table with a trigger or Prisma extension that records changes.

---

## NestJS v11 CQRS Updates

- Supports request-scoped providers in command/query handlers
- Strongly-typed commands, events, and queries via TypeScript generics
- `ICommandBus<TCommand>` and `IQueryBus<TQuery>` for type-safe dispatch
