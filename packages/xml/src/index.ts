import { processXmlOperations, type XmlInputItem, type XmlResultItem, type XmlOperation } from 'xml-core-mcp';

console.log('MCP XML Package Loaded (re-exporting core)');

// Re-export the core function and types
export { processXmlOperations };
export type { XmlInputItem, XmlResultItem, XmlOperation };
