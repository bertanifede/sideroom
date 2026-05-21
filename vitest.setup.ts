import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; components that observe element size need a stub.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
