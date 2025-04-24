import { describe, it, expect, vi } from 'vitest'; // Add vi
import { z } from 'zod';
import {
  defineTool,
  textPart,
  jsonPart,
  imagePart, // Keep existing imports
  audioPart, // Add audioPart
  fileRefPart, // Add fileRefPart
  TextPartSchema,
  JsonPartSchema,
  ImagePartSchema, // Keep existing imports
  AudioPartSchema, // Add AudioPartSchema
  FileRefPartSchema, // Add FileRefPartSchema
  PartSchema, // Add PartSchema
  isTextPart,
  isJsonPart,
  isImagePart,
  isAudioPart,
  isFileRefPart,
  when, // Import when
  mapWhen, // Import mapWhen
  validateAndResolvePath,
  type ToolExecuteOptions,
  type Part, // Import Part type
} from './index.js';
import path from 'node:path';

describe('Core Utilities', () => {
  // Test defineTool
  describe('defineTool', () => {
    const testSchema = z.object({ name: z.string() });
    const testTool = defineTool({
      name: 'testTool',
      description: 'A simple test tool',
      inputSchema: testSchema,
      execute: async (input: { name: string }) => {
        return [textPart(`Hello, ${input.name}!`)];
      },
    });

    it('should create a tool definition with correct properties', () => {
      expect(testTool).toBeDefined();
      expect(testTool.name).toBe('testTool');
      expect(testTool.description).toBe('A simple test tool');
      expect(testTool.inputSchema).toBe(testSchema);
      expect(typeof testTool.execute).toBe('function');
    });

    it('should execute the tool function correctly', async () => {
      const mockOptions: ToolExecuteOptions = { workspaceRoot: '/test' }; // Mock options
      const result = await testTool.execute({ name: 'World' }, mockOptions); // Pass options
      expect(result).toEqual([textPart('Hello, World!')]);
    });
  });

  // Test jsonPart
  describe('jsonPart', () => {
    it('should create a JSON part correctly', () => {
      const data = { key: 'value', count: 1 };
      const schema = z.object({ key: z.string(), count: z.number() });
      const part = jsonPart(data, schema);
      expect(part.type).toBe('json');
      expect(part.value).toEqual(data);
      expect(part.schema).toBe(schema);
    });
  });

  // Test textPart
  describe('textPart', () => {
    it('should create a text part correctly', () => {
      const text = 'This is a test.';
      const part = textPart(text);
      expect(part.type).toBe('text');
      expect(part.value).toBe(text);
    });
  });

  // Test Type Guards
  describe('Type Guards', () => {
    const text = textPart('test');
    const json = jsonPart({ data: 1 }, z.object({ data: z.number() }));
    const image = imagePart('imagedata', 'image/png');
    const audio = audioPart('audiodata', 'audio/mp3');
    const fileRef = fileRefPart('file.txt');

    it('isTextPart should correctly identify text parts', () => {
      expect(isTextPart(text)).toBe(true);
      expect(isTextPart(json)).toBe(false);
    });

    it('isJsonPart should correctly identify JSON parts', () => {
      expect(isJsonPart(json)).toBe(true);
      expect(isJsonPart(text)).toBe(false);
    });

    it('isImagePart should correctly identify image parts', () => {
        expect(isImagePart(image)).toBe(true);
        expect(isImagePart(text)).toBe(false);
    });

    it('isAudioPart should correctly identify audio parts', () => {
      expect(isAudioPart(audio)).toBe(true);
      expect(isAudioPart(text)).toBe(false);
    });

    it('isFileRefPart should correctly identify fileRef parts', () => {
      expect(isFileRefPart(fileRef)).toBe(true);
      expect(isFileRefPart(json)).toBe(false);
    });
  });

  // Test Part Helper Functions
  describe('Part Helper Functions', () => {
     it('imagePart should create a valid ImagePart', () => {
        const part = imagePart('base64imagedata', 'image/jpeg');
        expect(part).toEqual({ type: 'image', data: 'base64imagedata', mimeType: 'image/jpeg' });
        expect(ImagePartSchema.safeParse(part).success).toBe(true);
    });

    it('audioPart should create a valid AudioPart', () => {
      const part = audioPart('base64audiodata', 'audio/mpeg');
      expect(part).toEqual({ type: 'audio', data: 'base64audiodata', mimeType: 'audio/mpeg' });
      expect(AudioPartSchema.safeParse(part).success).toBe(true);
    });

    it('fileRefPart should create a valid FileRefPart', () => {
      const part = fileRefPart('./path/to/file.txt', 'text/plain');
      expect(part).toEqual({ type: 'fileRef', path: './path/to/file.txt', mimeType: 'text/plain' });
      expect(FileRefPartSchema.safeParse(part).success).toBe(true);
    });

     it('fileRefPart should create a valid FileRefPart without mimeType', () => {
      const part = fileRefPart('./path/to/other.bin');
      expect(part).toEqual({ type: 'fileRef', path: './path/to/other.bin', mimeType: undefined });
      expect(FileRefPartSchema.safeParse(part).success).toBe(true);
    });
  });

  // Test PartSchema Union Validation
  describe('PartSchema Union Validation', () => {
    it('should validate a TextPart', () => {
      const part = textPart('hello');
      expect(PartSchema.safeParse(part).success).toBe(true);
    });

    it('should validate a JsonPart', () => {
      const part = jsonPart({ a: 1 }, z.object({ a: z.number() }));
      expect(PartSchema.safeParse(part).success).toBe(true);
    });

     it('should validate an ImagePart', () => {
        const part = imagePart('imagedata', 'image/gif');
        expect(PartSchema.safeParse(part).success).toBe(true);
    });

    it('should validate an AudioPart', () => {
      const part = audioPart('audiodata', 'audio/wav');
      expect(PartSchema.safeParse(part).success).toBe(true);
    });

    it('should validate a FileRefPart', () => {
      const part = fileRefPart('some/file.pdf', 'application/pdf');
      expect(PartSchema.safeParse(part).success).toBe(true);
    });
  });

  // Test when function
  describe('when', () => {
    const text = textPart('hello');
    const json = jsonPart({ id: 1 }, z.object({ id: z.number() }));
    const image = imagePart('imgdata', 'image/png');
    const audio = audioPart('audiodata', 'audio/mp3');
    const fileRef = fileRefPart('ref.txt');

    it('should call the correct handler for text', () => {
      const textHandler = vi.fn(() => 'text result');
      const result = when(text, { text: textHandler });
      expect(textHandler).toHaveBeenCalledWith(text);
      expect(result).toBe('text result');
    });

    it('should call the correct handler for json', () => {
        const jsonHandler = vi.fn(() => 'json result');
        const result = when(json, { json: jsonHandler });
        expect(jsonHandler).toHaveBeenCalledWith(json);
        expect(result).toBe('json result');
    });

     it('should call the correct handler for image', () => {
        const imageHandler = vi.fn(() => 'image result');
        const result = when(image, { image: imageHandler });
        expect(imageHandler).toHaveBeenCalledWith(image);
        expect(result).toBe('image result');
    });

     it('should call the correct handler for audio', () => {
        const audioHandler = vi.fn(() => 'audio result');
        const result = when(audio, { audio: audioHandler });
        expect(audioHandler).toHaveBeenCalledWith(audio);
        expect(result).toBe('audio result');
    });

     it('should call the correct handler for fileRef', () => {
        const fileRefHandler = vi.fn(() => 'fileRef result');
        const result = when(fileRef, { fileRef: fileRefHandler });
        expect(fileRefHandler).toHaveBeenCalledWith(fileRef);
        expect(result).toBe('fileRef result');
    });

    it('should throw error if handler is missing', () => {
      expect(() => when(text, {})).toThrow("Handler for part type 'text' not found in mapper");
      expect(() => when(json, { text: () => {} })).toThrow("Handler for part type 'json' not found in mapper");
      expect(() => when(image, { text: () => {} })).toThrow("Handler for part type 'image' not found in mapper");
      expect(() => when(audio, { text: () => {} })).toThrow("Handler for part type 'audio' not found in mapper");
      expect(() => when(fileRef, { text: () => {} })).toThrow("Handler for part type 'fileRef' not found in mapper");
    });

     it('should return undefined if handler returns undefined', () => {
        const result = when(text, { text: () => undefined });
        expect(result).toBeUndefined();
    });
  });

  // Test mapWhen function
  describe('mapWhen', () => {
      const parts: Part[] = [
          textPart('one'),
          jsonPart({ num: 2 }, z.object({ num: z.number() })),
          imagePart('img', 'image/jpeg'),
          textPart('three'),
          audioPart('aud', 'audio/ogg'),
          fileRefPart('file.doc'),
      ];

      it('should map all parts when all handlers are provided', () => {
          const results = mapWhen(parts, {
              text: (p) => `T:${p.value}`,
              json: (p) => `J:${p.value.num}`,
              image: (p) => `I:${p.mimeType}`,
              audio: (p) => `A:${p.mimeType}`,
              fileRef: (p) => `F:${p.path}`,
          });
          expect(results).toEqual([
              'T:one',
              'J:2',
              'I:image/jpeg',
              'T:three',
              'A:audio/ogg',
              'F:file.doc',
          ]);
      });

      it('should ignore parts not specified in the mapper', () => {
          const results = mapWhen(parts, {
              text: (p) => `T:${p.value}`,
              fileRef: (p) => `F:${p.path}`,
              // json, image, audio handlers missing
          });
          expect(results).toEqual([
              'T:one',
              'T:three',
              'F:file.doc',
          ]);
      });

       it('should handle handlers returning undefined', () => {
          const results = mapWhen(parts, {
              text: (p) => p.value === 'one' ? `T:${p.value}` : undefined, // Only map 'one'
              json: (p) => `J:${p.value.num}`,
              image: (p) => undefined, // Ignore image
              audio: (p) => `A:${p.mimeType}`,
              fileRef: (p) => undefined, // Ignore fileRef
          });
          expect(results).toEqual([
              'T:one',
              'J:2',
              // image ignored
              // 'three' ignored
              'A:audio/ogg',
              // fileRef ignored
          ]);
      });

      it('should return an empty array for an empty mapper', () => {
          const results = mapWhen(parts, {});
          expect(results).toEqual([]);
      });

       it('should return an empty array for empty input parts', () => {
          const results = mapWhen([], { text: (p) => p.value });
          expect(results).toEqual([]);
      });
  });


  // Test validateAndResolvePath
  describe('validateAndResolvePath', () => {
    const workspaceRoot = path.resolve('/workspace');

    it('should resolve a valid path within the workspace', () => {
      const result = validateAndResolvePath('sub/file.txt', workspaceRoot);
      expect(result).toBe(path.join(workspaceRoot, 'sub', 'file.txt'));
    });

    it('should return an error for path outside workspace when not allowed', () => {
      const result = validateAndResolvePath('../outside.txt', workspaceRoot);
      const relativeToRoot = path.relative(workspaceRoot, path.resolve(workspaceRoot, '../outside.txt'));
      expect(result).toEqual({
        error: `Path validation failed: Path must resolve within the workspace root ('${workspaceRoot}'). Relative Path: '${relativeToRoot}'`,
        suggestion: `Ensure the path '../outside.txt' is relative to the workspace root and does not attempt to go outside it.`,
      });
    });

     it('should resolve a valid path outside workspace when allowed', () => {
      const result = validateAndResolvePath('../outside.txt', workspaceRoot, true);
       expect(result).toBe(path.resolve(workspaceRoot, '../outside.txt'));
    });

    it('should return an error for absolute path when not allowed', () => {
      const absolutePath = path.resolve('/absolute/path.txt');
      const result = validateAndResolvePath(absolutePath, workspaceRoot);
      expect(result).toEqual({
        error: `Path validation failed: Absolute paths are not allowed. Path: '${absolutePath}'`,
        suggestion: 'Provide a path relative to the workspace root.',
      });
    });

    it('should allow absolute path when allowed outside root', () => {
      const absolutePath = path.resolve('/absolute/path.txt');
      const result = validateAndResolvePath(absolutePath, workspaceRoot, true);
      expect(result).toBe(absolutePath);
    });

    it('should handle path resolution errors', () => {
      // Use an empty string, which should cause path functions to error reliably
      const invalidPath = '';
      const result = validateAndResolvePath(invalidPath, workspaceRoot);
      expect(typeof result).toBe('object'); // Should be an error object
      // Expect the specific error message for empty input path
      expect((result as any).error).toBe('Path validation failed: Input path cannot be empty.');
    });
  });
});
