# System Patterns: Babylon Portfolio

## Architecture

The project appears to follow a modular structure, likely organized by feature or scene within the `src/playground/` directory. A central `app.ts` likely handles the overall application setup and scene switching/loading.

## Key Technical Decisions (Inferred)

- **Engine:** Uses Babylon.js, potentially supporting both WebGL (Engine) and WebGPU (WebGPUEngine).
- **Language:** TypeScript for type safety and modern JavaScript features.
- **Build Tool:** Vite is used for development server and bundling (inferred from `vite.config.ts`, `vite-env.d.ts`).
- **Scene Structure:** Scenes seem to be encapsulated within classes (e.g., `PlayerControllerScene`, `Ground`).

## Design Patterns

- **Class-based Components:** Scenes and potentially other elements (like `Ground`) are implemented as classes, promoting encapsulation and reusability.
- **Dependency Injection (Implicit):** Scene, canvas, and engine instances are passed into scene constructors.

## Component Relationships

- `app.ts` likely instantiates and manages the active scene (e.g., `PlayerControllerScene`).
- Scene classes (like `PlayerControllerScene`) manage their own elements (camera, lights, specific components like `Ground`).
