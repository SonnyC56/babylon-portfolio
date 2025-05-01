# Tech Context: Babylon Portfolio

## Technologies Used

- **Core:** Babylon.js (JavaScript/TypeScript 3D engine)
- **Language:** TypeScript
- **Build/Dev:** Vite, Node.js/npm (for package management)
- **Physics (Potential):** Havok physics plugin for Babylon.js (based on the provided scene code)

## Development Setup

- Install dependencies using `npm install`.
- Run the development server using `npm run dev` (inferred standard practice).
- Build for production using `npm run build` (inferred standard practice).

## Technical Constraints

- Browser compatibility limitations inherent to WebGL/WebGPU and Babylon.js.
- Performance considerations for complex 3D scenes, especially on lower-end hardware.

## Dependencies (from package.json - *needs verification*)

- `@babylonjs/core`: Core Babylon.js library.
- `@babylonjs/havok`: Havok physics plugin.
- `@babylonjs/loaders`: Asset loaders (e.g., for GLB files).
- `typescript`: TypeScript compiler.
- `vite`: Build tool and development server.
- Potentially others... (Requires reading `package.json`)
