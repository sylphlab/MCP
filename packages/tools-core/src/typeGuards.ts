import type { ZodTypeAny } from 'zod';
import type { AudioPart, FileRefPart, ImagePart, JsonPart, Part, TextPart } from './index.js'; // Assuming Part is exported from core/index.js

// Add type guards for standard Part types if they don't exist

export function isTextPart(part: Part): part is TextPart {
    return part.type === 'text';
}

export function isJsonPart<T extends ZodTypeAny>(part: Part): part is JsonPart<T> {
    return part.type === 'json';
}

export function isImagePart(part: Part): part is ImagePart {
    return part.type === 'image';
}

export function isAudioPart(part: Part): part is AudioPart {
    return part.type === 'audio';
}

export function isFileRefPart(part: Part): part is FileRefPart {
    return part.type === 'fileRef';
}

export function when<T, J, I, A, F>(part: Part, mapper: {
    text?: (part: TextPart) => T, // Make handlers optional in the type signature
    json?: (part: JsonPart) => J,
    image?: (part: ImagePart) => I,
    audio?: (part: AudioPart) => A,
    fileRef?: (part: FileRefPart) => F
}): T | J | I | A | F | undefined { // Return type remains potentially undefined
    if (isTextPart(part)) {
        if (mapper.text) return mapper.text(part);
        throw new Error(`Handler for part type 'text' not found in mapper`);
    }
    if (isJsonPart(part)) {
        if (mapper.json) return mapper.json(part);
        throw new Error(`Handler for part type 'json' not found in mapper`);
    }
    if (isImagePart(part)) {
        if (mapper.image) return mapper.image(part);
        throw new Error(`Handler for part type 'image' not found in mapper`);
    }
    if (isAudioPart(part)) {
        if (mapper.audio) return mapper.audio(part);
        throw new Error(`Handler for part type 'audio' not found in mapper`);
    }
    if (isFileRefPart(part)) {
        if (mapper.fileRef) return mapper.fileRef(part);
        throw new Error(`Handler for part type 'fileRef' not found in mapper`);
    }
    // This should be unreachable if all part types are handled above
    throw new Error(`Unhandled part type: ${part.type}`);
}

export function mapWhen<T, J, I, A, F>(
  parts: Part[],
  mapper: {
    text?: (part: TextPart) => T | undefined; // Make handlers optional
    json?: (part: JsonPart) => J | undefined;
    image?: (part: ImagePart) => I | undefined;
    audio?: (part: AudioPart) => A | undefined;
    fileRef?: (part: FileRefPart) => F | undefined;
  },
): (T | J | I | A | F)[] {
  const results: (T | J | I | A | F)[] = [];
  for (const part of parts) {
    let result: T | J | I | A | F | undefined;
    if (isTextPart(part) && mapper.text) {
      result = mapper.text(part);
    } else if (isJsonPart(part) && mapper.json) {
      result = mapper.json(part);
    } else if (isImagePart(part) && mapper.image) {
      result = mapper.image(part);
    } else if (isAudioPart(part) && mapper.audio) {
      result = mapper.audio(part);
    } else if (isFileRefPart(part) && mapper.fileRef) {
      result = mapper.fileRef(part);
    }
    // Only add the result if it's not undefined
    if (result !== undefined) {
      results.push(result);
    }
  }
  return results;
}