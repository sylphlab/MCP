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
    text: (part: TextPart) => T,
    json: (part: JsonPart) => J,
    image: (part: ImagePart) => I,
    audio: (part: AudioPart) => A,
    fileRef: (part: FileRefPart) => F
}): T | J | I | A | F {
    if (isTextPart(part)) return mapper.text(part);
    if (isJsonPart(part)) return mapper.json(part);
    if (isImagePart(part)) return mapper.image(part);
    if (isAudioPart(part)) return mapper.audio(part);
    if (isFileRefPart(part)) return mapper.fileRef(part);
    throw new Error(`Unhandled part type: ${part.type}`);
}

export function mapWhen<T, J, I, A, F>(parts: Part[], mapper: {
    text: (part: TextPart) => T,
    json: (part: JsonPart) => J,
    image: (part: ImagePart) => I,
    audio: (part: AudioPart) => A,
    fileRef: (part: FileRefPart) => F
}): (T | J | I | A | F)[] {
    return parts.map(part => when(part, mapper)); // Adjust the initial value as needed
}