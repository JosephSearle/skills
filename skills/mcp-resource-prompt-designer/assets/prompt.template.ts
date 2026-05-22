// Targets: @rekog/mcp-nest ^1.0.0
// Replace <PLACEHOLDER> values before use.
// IMPORTANT: Prompts are user-invoked templates, NOT autonomous model actions.

import { Injectable } from '@nestjs/common';
import { Prompt } from '@rekog/mcp-nest';

@Injectable()
export class <Name>Prompt {
  @Prompt({
    name: '<domain>_<action>',  // e.g. code_review, order_summary — namespaced, snake_case
    description: '<One sentence: what conversation this prompt starts and when the user should invoke it.>',
    arguments: [
      {
        name:        '<arg1>',
        description: '<Plain English: what this argument specifies>',
        required:    true,
      },
      {
        name:        '<arg2>',
        description: '<Plain English>',
        required:    false,  // optional argument
      },
    ],
  })
  async create<Name>({ <arg1>, <arg2> = '<default>' }: { <arg1>: string; <arg2>?: string }) {
    // Sanitise argument values before embedding in the message
    // Use XML delimiters to prevent injection — argument values cannot close the outer tag
    const safe<Arg1> = sanitise(<arg1>);

    return {
      description: '<One sentence shown in client UI before user submits>',
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            // XML delimiters prevent argument values from injecting instructions
            text: `<Instruction based on ${<arg2>}>:\n\n<input>\n${safe<Arg1>}\n</input>`,
          },
        },
      ],
    };
  }
}

// Inline sanitiser — replace with a shared utility in larger codebases
function sanitise(text: string, maxLength = 10_000): string {
  return text
    .replace(/<[^>]+>/g, ' ')                            // strip HTML
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // strip control chars
    .trim()
    .slice(0, maxLength);
}
