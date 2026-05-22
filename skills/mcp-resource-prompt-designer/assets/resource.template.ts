// Targets: @rekog/mcp-nest ^1.0.0
// Replace <PLACEHOLDER> values before use.

import { Injectable } from '@nestjs/common';
import { Resource, ResourceTemplate, Context } from '@rekog/mcp-nest';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Replace with your actual service
import { <YourService> } from '../../../<your-service>.service';

// ─── Static Resource ────────────────────────────────────────────────────────
@Injectable()
export class <Name>StaticResource {
  @Resource({
    uri:         'mcp://<server-name>/<resource-path>',  // fixed URI
    name:        '<domain>_<name>',                        // namespaced, snake_case
    description: '<One sentence: what this resource contains and when to read it.>',
    mimeType:    '<application/json | text/plain | text/markdown>',
  })
  async get<Name>() {
    return {
      contents: [{
        uri:      'mcp://<server-name>/<resource-path>',
        mimeType: '<application/json | text/plain | text/markdown>',
        text:     JSON.stringify({ /* your content */ }),
        // For binary content, use: blob: base64EncodedString
      }],
    };
  }
}

// ─── Dynamic (Templated) Resource ───────────────────────────────────────────
@Injectable()
export class <Name>TemplateResource {
  constructor(private readonly service: <YourService>) {}

  @ResourceTemplate({
    uriTemplate: 'mcp://<server-name>/<collection>/{<paramName>}',  // RFC 6570
    name:        '<domain>_<name>_by_id',
    description: '<One sentence: what this resource contains. The {<paramName>} identifies which item.>',
    mimeType:    'application/json',
  })
  async get<Name>({ <paramName> }: { <paramName>: string }, ctx: Context) {
    const item = await this.service.findById(<paramName>);

    if (!item) {
      // Resource not found → MCP error -32002 (invisible to LLM)
      throw new McpError(ErrorCode.ResourceNotFound, `<Name> ${<paramName>} not found`);
    }

    return {
      contents: [{
        uri:      `mcp://<server-name>/<collection>/${<paramName>}`,
        mimeType: 'application/json',
        text:     JSON.stringify(item),
      }],
    };
  }
}
