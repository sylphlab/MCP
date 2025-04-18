import { processXmlOperations, type XmlInputItem, type XmlResultItem, type XmlOperation } from '@sylphlab/mcp-xml-core';

console.log('MCP XML Package Loaded (re-exporting core)');

// Re-export the core function and types
export { processXmlOperations };
export type { XmlInputItem, XmlResultItem, XmlOperation };
