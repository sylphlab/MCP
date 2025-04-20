// src/wasm.d.ts
declare module '*.wasm' {
  const url: string; // Or path, depending on the loader/environment
  export default url;
}