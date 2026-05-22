// Targets: @nestjs/common ^10.x
// Implements RFC 9728 OAuth Protected Resource Metadata
// Copy to: src/authz/prm-metadata.controller.ts
// Register in AppModule controllers array.

import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '@nestjs/passport';  // or use @SkipAuth() custom decorator

@Controller('.well-known')
export class PrmMetadataController {
  constructor(private readonly cfg: ConfigService) {}

  @Get('oauth-protected-resource')
  @Public()  // This endpoint must be unauthenticated
  getProtectedResourceMetadata() {
    const resourceUri  = this.cfg.getOrThrow<string>('MCP_RESOURCE_URI');
    const authServers  = this.cfg.getOrThrow<string>('OAUTH_AUTHORIZATION_SERVER_URLS')
      .split(',')
      .map(u => u.trim());

    return {
      // RFC 9728 required fields
      resource: resourceUri,
      authorization_servers: authServers,
      bearer_methods_supported: ['header'],

      // Declare the scopes your tools require
      scopes_supported: [
        'tools:read',
        'tools:write',
        // Add your tool-specific scopes here
      ],

      // Algorithms supported for token signatures
      resource_signing_alg_values_supported: ['RS256', 'ES256'],
    };
  }
}
