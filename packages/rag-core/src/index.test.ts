import { describe, expect, it } from 'vitest';
import * as ragCore from '../src/index.js'; // Adjust path if build output is different

describe('@sylphlab/mcp-rag-core entry point', () => {
  it('should export core types and functions', () => {
    // Types (checking runtime presence of related values/schemas where applicable)
    expect(ragCore.EmbeddingModelProvider).toBeDefined();
    expect(ragCore.EmbeddingModelConfigSchema).toBeDefined();
    expect(ragCore.defaultEmbeddingConfig).toBeDefined();
    expect(ragCore.VectorDbConfigSchema).toBeDefined();
    expect(ragCore.VectorDbProvider).toBeDefined();
    expect(ragCore.SupportedLanguage).toBeDefined();

    // Functions
    expect(ragCore.chunkCodeAst).toBeInstanceOf(Function);
    expect(ragCore.detectLanguage).toBeInstanceOf(Function);
    expect(ragCore.generateEmbeddings).toBeInstanceOf(Function);
    expect(ragCore.parseCode).toBeInstanceOf(Function);
    expect(ragCore.loadDocuments).toBeInstanceOf(Function);
    expect(ragCore.getRagCollection).toBeInstanceOf(Function);
    expect(ragCore.convertFilterToChromaWhere).toBeInstanceOf(Function);

    // Classes/Constructors
    expect(ragCore.OllamaEmbeddingFunction).toBeInstanceOf(Function);
    expect(ragCore.MockEmbeddingFunction).toBeInstanceOf(Function);
    expect(ragCore.IndexManager).toBeInstanceOf(Function);

    // Tools
    expect(ragCore.indexContentTool).toBeDefined();
    expect(ragCore.queryIndexTool).toBeDefined();
    expect(ragCore.indexStatusTool).toBeDefined();
  });

  // Add more specific tests later if needed
});
