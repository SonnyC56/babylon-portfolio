# Active Context: Babylon Portfolio

## Current Work Focus

The primary task is to integrate a new scene definition into the existing `PlayerControllerScene` class located at `src/playground/player-controller.ts`. The new scene definition includes:
- A `FreeCamera` (replacing the existing `ArcRotateCamera`).
- A specific `HemisphericLight` setup.
- Havok physics initialization.
- Loading a GLB level (`levelTest.glb`) and a lightmap texture.
- Setting up static physics shapes for level geometry.
- Setting up dynamic physics for interactive cubes and an inclined plane with a hinge joint.
- Implementing a character controller using `PhysicsCharacterController`.
- Defining character states (`IN_AIR`, `ON_GROUND`, `START_JUMP`) and movement logic based on state, input, and physics support checks.
- Handling user input (keyboard for movement/jump, mouse for camera rotation).
- Updating camera and character display based on physics simulation.

## Recent Changes

- Initialized the Memory Bank by creating the core files (`projectbrief.md`, `productContext.md`, `systemPatterns.md`, `techContext.md`, `activeContext.md`, `progress.md`).
- Verified dependencies (`@babylonjs/havok`, `@babylonjs/loaders`) in `package.json`.
- Replaced the content of `src/playground/player-controller.ts` with the new physics-based character controller scene logic.
- Corrected several TypeScript errors in `src/playground/player-controller.ts`, including import paths, property access, method calls, and the `PhysicsCharacterController` constructor signature/options.
- Increased the character controller's initial Y-position from 0.3 to 1.0 to potentially fix falling through the ground.

## Next Steps

1.  Update `progress.md`.
2.  Test the updated `PlayerControllerScene`.
3.  Potentially update `app.ts` if needed to ensure the scene runs correctly.
