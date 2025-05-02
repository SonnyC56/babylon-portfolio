# Active Context: Babylon Portfolio - Starwhal Scene

## Current Work Focus

The primary task was the creation and initial implementation of a new playground scene, `StarwhalScene`, inspired by the game Starwhal. This involved setting up the scene structure, arena, physics, narwhal characters, basic controls, and collision detection.

## Recent Changes

- **New Directory:** Created `src/playground/starwhal/`.
- **New Files:**
    - `src/playground/starwhal/starwhal-scene.ts`: Contains the main scene logic, including arena setup (neon grid floor, oval boundaries, spinning pillars, bubble zones), Havok physics initialization (no gravity), orthographic camera, lighting, narwhal spawning, basic keyboard controls (Arrow Keys for Player 1), and collision registration (tusk-heart, bubble zones). Uses the global scene/engine provided by `app.ts`.
    - `src/playground/starwhal/narwhal.ts`: Defines the `Narwhal` class, encapsulating the core physics body (invisible sphere, now temporarily visible for debugging), visible tube mesh for the body (simulated soft body effect), tusk cone, heart sphere, associated physics impostors, materials, life tracking (`takeHit`), and control methods (`applyRotation`, `applyThrust`). Added console logging to `applyRotation`.
- **Integration:** Modified `src/app.ts` to import and instantiate `StarwhalScene` within the `initWebGPU` method, passing the global scene, engine, and canvas. Commented out the global physics initialization in `app.ts` as `StarwhalScene` handles its own. Ensured the global render loop in `app.ts` is active.
- **Debugging (Rotation/Collision):**
    - Increased `ROTATION_TORQUE` in `starwhal-scene.ts` from 0.5 to 5.0.
    - Added console logs for left/right arrow key detection in `starwhal-scene.ts`.
    - Increased arena wall `numSegments` in `starwhal-scene.ts` from 32 to 64 for smoothness.
    - Made the core physics sphere visible in `narwhal.ts` constructor.

## Next Steps

1.  **Testing (Post-Debug Changes):** Test the impact of the recent debugging changes:
    - Verify if rotation (Left/Right Arrows) now works. Check console logs for input detection and torque application.
    - Observe collisions with the smoother arena wall. Check if the visible core sphere collides as expected.
    - Assess if the increased wall segments improved the visual appearance and collision behavior.
2.  Update `progress.md` based on testing results.
3.  **Refinement (If needed):**
    - Further adjust `ROTATION_TORQUE` or investigate physics settings if rotation is still problematic.
    - Adjust wall physics properties (`friction`, `restitution`) if collisions aren't behaving correctly.
    - Fine-tune the soft-body simulation (`lagFactor`, `segmentLength`).
    - Improve visual feedback on hits.
4.  **Features:**
    - Implement basic UI (lives display).
    - Add round management logic (`_checkRoundEnd` implementation, restart mechanism).
    - Add controls for Player 2 (e.g., WASD).
    - Implement timer mode.
