 # Progress: Babylon Portfolio

## What Works

- **Project Setup:** Basic structure (TypeScript, Vite), dependencies installed (`@babylonjs/havok`, `@babylonjs/loaders`, `@babylonjs/gui`).
- **Memory Bank:** Core files initialized and being updated.
- **Player Controller Scene (`player-controller.ts`):**
    - Integrated new physics-based character controller logic.
    - Resolved initial TypeScript errors.
    - Adjusted character's starting Y-position (needs testing).
- **Mini Golf Scene (`mini-golf-scene.ts`):**
    - Procedural multi-level course generation (`CourseGenerator`).
    - Ramp creation and velocity boost logic.
    - Ball respawn logic (out-of-bounds detection, penalty stroke).
    - Power meter logic (controlled by mouse drag).
    - Directional control logic (keyboard input, GUI toggle logic present but GUI disabled).
    - Scorecard setup and update logic present (but GUI disabled).
    - **Input refined:** Shooting now requires clicking directly on the ball.
    - **Subsequent shots:** Enabled after the ball stops.
    - **Hole collision:** Y-tolerance adjusted for detection.
    - **GUI Temporarily Disabled:** All GUI elements are currently disabled due to reported errors.
- **Starwhal Scene (`starwhal-scene.ts`, `narwhal.ts`):**
    - Initial scene setup with orthographic camera and basic lighting.
    - Arena created: Neon grid floor, bouncy oval walls, spinning pillars, bubble zones (triggers).
    - Havok physics integrated (using `PhysicsBody`/`PhysicsShape` API).
    - Narwhal class created: Core dynamic body, kinematic tusk/heart bodies, simulated soft-body visual tail.
    - Basic keyboard controls (Arrow Keys for Player 1) implemented for rotation and thrust.
    - Collision detection implemented: Tusk-heart collisions trigger `takeHit`, bubble zones apply random forces.
    - Integrated into `app.ts` to load the scene.
    - Refactored from initial `PhysicsImpostor` implementation to correct `PhysicsBody`/`PhysicsShape` API usage.
    - Fixed camera activation issue.
    - **Resolved `MeshBuilder.CreateCone` TypeScript error** (by setting `isolatedModules: false` in `tsconfig.json`).
    - **Resolved `No camera defined` runtime error** (by refactoring `StarwhalScene` with `async initialize()` and awaiting it in `app.ts`).

## What's Left to Build

- **Player Controller Scene:**
    - Test the scene thoroughly to verify character controller behavior and collision fix.
    - Potentially update `app.ts` if scene loading needs adjustment.
- **Mini Golf Scene:**
    - Test current gameplay mechanics (shooting, subsequent shots, hole collision, ramps, respawn, directional control).
    - **Fix GUI Errors:** Investigate and resolve the `AdvancedDynamicTexture` errors to re-enable the stroke counter, power meter, directional toggle, and scorecard.
    - Implement remaining features from example:
        - Flagpole/flag visuals.
        - Camera switching options.
        - Hole completion/Game Over messages/logic.
        - Control instructions panel.
        - Ball texture.
    - Refine physics parameters (restitution, friction, damping, boost, directional force) as needed.
- **Starwhal Scene:**
    - **Testing (Post-Debug Changes):** Test rotation (Left/Right Arrows), wall collisions, and visual smoothness after recent debugging changes (increased torque, increased wall segments, added logs, made core visible).
    - **Refinement:** Based on testing, adjust physics parameters (torque, friction, restitution), soft-body simulation, hit feedback.
    - **Features:** Implement UI (lives), round management, Player 2 controls, timer mode.
- **General:**
    - Update `.cursor/rules` if significant patterns emerge.

## Current Status

- Completed initial implementation and physics refactoring for the new Starwhal scene.
- **Fixed critical runtime and TypeScript errors** related to Starwhal scene initialization and `MeshBuilder`.
- **Attempted Debugging:** Applied changes to address Starwhal rotation and collision issues (increased torque, wall segments, added logs, made core visible).
- Updated Memory Bank (`activeContext.md`, `progress.md`).

## Known Issues

- **Mini Golf GUI:** `AdvancedDynamicTexture` errors preventing GUI display (currently disabled).
- **Player Controller:** Character potentially falling through ground (needs testing after Y-position adjustment).
- **Starwhal Controls/Collision:** Rotation (Left/Right Arrows) and wall collisions were reported as not working correctly; debugging changes applied, pending testing.
