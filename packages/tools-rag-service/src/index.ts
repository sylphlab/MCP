// Main entry point for @sylphlab/tools-rag-service

// Export necessary types and the service class
// export * from './types'; // Add if service-specific types are created
export { RagIndexService } from './ragIndexService.js';

// Re-export the service config type defined within this package
export type { RagServiceConfig } from './types.js';
// Re-export core config type from the core package
export type { RagConfig } from '@sylphlab/tools-rag';