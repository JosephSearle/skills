// Targets: @rekog/mcp-nest ^1.0.0
// Replace all <PLACEHOLDER> values before use.
// Usage: copy this file to src/mcp/tools/<domain>.tool.ts

import { Injectable } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Replace with your actual service dependency
import { <YourService> } from '../../../<your-service>.service';

const <ToolName>Schema = z.object({
  // Example fields — replace with your tool's actual inputs:
  // id: z.string().uuid().describe('UUID of the resource'),
  // query: z.string().min(1).max(500).describe('Search query string'),
  // status: z.enum(['active', 'inactive']).describe('Filter by status: active | inactive'),
});

@Injectable()
export class <ToolName>Tool {
  constructor(private readonly service: <YourService>) {}

  @Tool({
    name: '<domain>_<verb>',  // e.g. customers_search, orders_create — namespaced, lowercase
    description: '<One sentence: what this tool does and what inputs it expects.>',
    parameters: <ToolName>Schema,
    annotations: {
      // Set all four explicitly — never rely on defaults
      readOnlyHint:   <true | false>,  // true if no state changes
      destructiveHint: <true | false>, // true if deletes or irreversibly overwrites
      idempotentHint: <true | false>,  // true if same args → same result, no extra effect
      openWorldHint:  <true | false>,  // true if calls external APIs / internet
      title: '<Human-readable tool name>',
    },
  })
  async execute(
    args: z.infer<typeof <ToolName>Schema>,
    ctx: Context,
  ) {
    // Optional: report progress on long-running tools (stateful mode only)
    // await ctx.reportProgress({ progress: 0, total: 100, message: 'Starting...' });

    // --- Business logic ---
    let result;
    try {
      result = await this.service.<method>(args);
    } catch (err) {
      // Infrastructure failure (DB down, network error) — host handles; LLM never sees
      if (err instanceof <InfrastructureError>) {
        throw new McpError(ErrorCode.InternalError, '<service> is unavailable');
      }
      throw err;
    }

    // Business failure — LLM sees this and can self-correct
    if (!result) {
      return {
        content: [{ type: 'text' as const, text: '<Resource> not found.' }],
        isError: true,
      };
    }

    // Success
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    };
  }
}
