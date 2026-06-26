# Background Jobs with @nestjs/bullmq

**Authority:** docs.nestjs.com/techniques/queues

---

## Install

```bash
npm install @nestjs/bullmq bullmq ioredis
```

---

## Module Setup

```typescript
// app.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100, // keep last 100 completed jobs
          removeOnFail: 500,     // keep last 500 failed jobs
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: 'emails' }),
    BullModule.registerQueue({ name: 'pdf-generation' }),
  ],
})
export class AppModule {}
```

---

## Producer — Adding Jobs to a Queue

```typescript
// email.producer.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface WelcomeEmailJobData {
  userId: string;
  email: string;
  name: string;
}

@Injectable()
export class EmailProducer {
  constructor(
    @InjectQueue('emails') private readonly emailsQueue: Queue,
  ) {}

  async sendWelcomeEmail(data: WelcomeEmailJobData): Promise<void> {
    await this.emailsQueue.add('welcome-email', data, {
      delay: 5000,   // send 5 seconds after signup
      priority: 1,   // 1 = highest priority
    });
  }

  async scheduleReminder(data: ReminderJobData, delayMs: number): Promise<void> {
    await this.emailsQueue.add('reminder-email', data, { delay: delayMs });
  }
}
```

---

## Consumer — Processing Jobs

```typescript
// email.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('emails')
export class EmailProcessor extends WorkerHost {
  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'welcome-email':
        await this.emailService.sendWelcome(job.data as WelcomeEmailJobData);
        break;
      case 'reminder-email':
        await this.emailService.sendReminder(job.data as ReminderJobData);
        break;
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}
```

Register the processor in the feature module:

```typescript
@Module({
  imports: [BullModule.registerQueue({ name: 'emails' })],
  providers: [EmailProducer, EmailProcessor],
  exports: [EmailProducer],
})
export class EmailModule {}
```

---

## Graceful Shutdown on SIGTERM

Workers must stop accepting new jobs before the process exits. Use `onModuleDestroy`:

```typescript
// email.processor.ts
import { OnModuleDestroy } from '@nestjs/common';

@Processor('emails')
export class EmailProcessor extends WorkerHost implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    // Close the worker — waits for the current job to complete before stopping
    await this.worker.close();
  }

  // ...
}
```

This integrates with NestJS's shutdown hooks (`app.enableShutdownHooks()` in `main.ts`). When SIGTERM is received, NestJS calls `onModuleDestroy` on all providers, including the worker.

> ⚠️ **Gotcha:** Without `enableShutdownHooks()` in `main.ts`, `onModuleDestroy` is never called. The worker process exits mid-job, leaving jobs in an inconsistent state (stuck in "active" status in Redis).

→ See `apicraft-devops` for the full graceful shutdown setup including PID 1 / Tini.
