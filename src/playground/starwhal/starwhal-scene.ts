// Removed duplicate import
import * as BABYLON from '@babylonjs/core';
// Added missing Physics types
import { Vector3, Color3, MeshBuilder, StandardMaterial, HemisphericLight, FreeCamera, HavokPlugin, Scene, Engine, WebGPUEngine, CreateLineSystem, CreateCylinder, CreateSphere, Mesh, Quaternion, ActionManager, ExecuteCodeAction, Scalar, KeyboardEventTypes, PhysicsBody, PhysicsShapeBox, PhysicsShapeCylinder, PhysicsShapeSphere, PhysicsMotionType } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { Narwhal } from './narwhal'; // Import the Narwhal class

export class StarwhalScene {
    private _scene: Scene; // Will be passed in
    private _engine: Engine | WebGPUEngine; // Will be passed in
    private _havokInstance: any;
    private _spinningPillars: Mesh[] = [];
    private _bubbleZones: Mesh[] = [];
    private _narwhals: Narwhal[] = [];
    private _arenaWidth = 28;
    private _arenaHeight = 18;
    private _inputMap: { [key: string]: boolean } = {};
    private _canvas: HTMLCanvasElement; // Store canvas if needed later

    // Control constants
    private readonly ROTATION_TORQUE = 5.0; // Increased torque
    private readonly THRUST_FORCE = 15;

    // Accept scene, engine, and canvas from App
    constructor(scene: Scene, engine: Engine | WebGPUEngine, canvas: HTMLCanvasElement) {
        this._scene = scene; // Use the passed-in scene
        this._engine = engine;
        this._canvas = canvas; // Store canvas reference
        console.log("StarwhalScene Constructor: Basic references stored.");
    }

    // --- Initialization ---

    // Public async method for App to await
    public async initialize(): Promise<void> {
        console.log("StarwhalScene Initializing...");
        await this._initializePhysics();
        this._setupCamera(); // Camera needs to be attached to the scene
        this._setupLighting();
        this._createArena();
        this._createNarwhals(2); // Consider making this async if Narwhal constructor becomes async
        this._setupControls();
        this._setupCollisionLogic(); // This uses executeWhenReady, so it's okay here

        // Register updates within the scene's render loop (managed by App)
        this._scene.onBeforeRenderObservable.add(() => {
            this._processInput();
            this._applyBubbleZoneForces();
            this._narwhals.forEach(narwhal => narwhal.update());
            // Optional: Add round end check here
            // this._checkRoundEnd();
        });
        console.log("StarwhalScene Initialization Complete.");
    }


    private async _initializePhysics(): Promise<void> {
        try {
            this._havokInstance = await HavokPhysics();
            const havokPlugin = new HavokPlugin(true, this._havokInstance);
            this._scene.enablePhysics(new Vector3(0, 0, 0), havokPlugin); // No gravity for top-down view
            console.log("Havok Physics Initialized for StarwhalScene");
        } catch (e) {
            console.error("Failed to initialize Havok Physics for StarwhalScene:", e);
        }
    }

    private _setupCamera(): void {
        // Using a fixed orthographic camera for a 2D feel
        const aspectRatio = this._engine.getRenderWidth() / this._engine.getRenderHeight();
        const orthoSize = 30; // Increased size to better fit arena
        const camera = new FreeCamera("orthoCamera", new Vector3(0, 50, 0), this._scene); // Positioned above
        camera.setTarget(Vector3.Zero());
        camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;

        // Set orthographic properties based on aspect ratio
        camera.orthoTop = orthoSize / 2;
        camera.orthoBottom = -orthoSize / 2;
        camera.orthoLeft = -orthoSize * aspectRatio / 2;
        camera.orthoRight = orthoSize * aspectRatio / 2;

        this._scene.activeCamera = camera; // Set this camera as active for the scene

        // Attach camera controls if needed for debugging
        // camera.attachControl(canvas, true);
        console.log("Starwhal Camera Setup Complete");
    }

    private _setupLighting(): void {
        // Simple hemispheric light is often sufficient for this style
        const light = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), this._scene);
        light.intensity = 1.0; // Slightly brighter
        console.log("Starwhal Lighting Setup Complete");
    }

    // --- Arena Creation ---
    // (No changes needed inside _createArena itself)
    private _createArena(): void {
        console.log("Creating Arena...");

        // Use stored dimensions
        const arenaWidth = this._arenaWidth;
        const arenaHeight = this._arenaHeight;
        const wallThickness = 0.5;
        const wallHeight = 2;

        // 1. Floor with Neon Grid
        const ground = MeshBuilder.CreateGround("ground", { width: arenaWidth * 1.2, height: arenaHeight * 1.2 }, this._scene);
        const groundMat = new StandardMaterial("groundMat", this._scene);
        groundMat.diffuseColor = new Color3(0.05, 0.05, 0.15);
        groundMat.specularColor = Color3.Black();
        groundMat.emissiveColor = new Color3(0.1, 0.1, 0.3);
        ground.material = groundMat;
        ground.position.y = -wallHeight / 2;

        // Neon Grid Lines
        const gridColor = new Color3(0, 1, 1); // Cyan neon
        const gridColor4 = gridColor.toColor4(); // Convert once
        const gridSize = 30;
        const gridLines: Vector3[][] = []; // Explicitly type as Vector3[][]
        const gridLineColors: BABYLON.Color4[][] = []; // Explicitly type as Color4[][]

        for (let i = -gridSize / 2; i <= gridSize / 2; i++) {
            // Vertical lines
            const startV = new Vector3(i, -wallHeight / 2 + 0.01, -gridSize / 2);
            const endV = new Vector3(i, -wallHeight / 2 + 0.01, gridSize / 2);
            gridLines.push([startV, endV]);
            gridLineColors.push([gridColor4, gridColor4]); // Assign color to this segment

            // Horizontal lines
            const startH = new Vector3(-gridSize / 2, -wallHeight / 2 + 0.01, i);
            const endH = new Vector3(gridSize / 2, -wallHeight / 2 + 0.01, i);
            gridLines.push([startH, endH]);
            gridLineColors.push([gridColor4, gridColor4]); // Assign color to this segment
        }
        const lineSystem = CreateLineSystem("gridLines", { lines: gridLines, colors: gridLineColors }, this._scene);
        lineSystem.isPickable = false;

        // Ground Physics (Static Box)
        const groundShape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(arenaWidth * 1.2, wallHeight, arenaHeight * 1.2), this._scene);
        const groundBody = new PhysicsBody(ground, PhysicsMotionType.STATIC, false, this._scene);
        groundBody.shape = groundShape;
        // Set friction/restitution if needed (defaults are often fine for static ground)
        // groundBody.setMaterial({ friction: 0.5, restitution: 0.1 });


        // 2. Bouncy Oval Boundaries (Static Boxes)
        const numSegments = 64; // Increased segments for smoother oval
        const segmentLength = (Math.PI * 2 * Math.sqrt((arenaWidth * arenaWidth + arenaHeight * arenaHeight) / 8)) / numSegments; // Approx circumference / segments
        const restitution = 0.8; // Bounciness
        const friction = 0.1;

        for (let i = 0; i < numSegments; i++) {
            const angle = (i / numSegments) * Math.PI * 2;
            const nextAngle = ((i + 1) / numSegments) * Math.PI * 2;

            // Calculate position on ellipse
            const x = (arenaWidth / 2) * Math.cos(angle);
            const z = (arenaHeight / 2) * Math.sin(angle);
            const wallPos = new Vector3(x, 0, z);

            // Calculate rotation to face center (approximately)
            const lookAtCenter = Vector3.Zero().subtract(wallPos);
            const angleY = Math.atan2(lookAtCenter.x, lookAtCenter.z);

            const wall = MeshBuilder.CreateBox(`wall_${i}`, { width: segmentLength, height: wallHeight, depth: wallThickness }, this._scene);
            wall.position = wallPos;
            wall.rotationQuaternion = Quaternion.FromEulerAngles(0, angleY, 0); // Use Quaternion for rotation

            // Wall Material (optional, could be invisible or styled)
            const wallMat = new StandardMaterial(`wallMat_${i}`, this._scene);
            wallMat.diffuseColor = new Color3(0.2, 0.8, 0.8);
            wallMat.emissiveColor = new Color3(0.1, 0.4, 0.4);
            wallMat.alpha = 0.5; // Semi-transparent
            wall.material = wallMat;

            // Wall Physics (Static Box)
            const wallShape = new PhysicsShapeBox(Vector3.Zero(), Quaternion.Identity(), new Vector3(segmentLength, wallHeight, wallThickness), this._scene);
            // TODO: Apply friction/restitution directly to shape if needed/possible, or via PhysicsMaterial
            wallShape.material = { friction: friction, restitution: restitution }; // Set material properties on the shape
            const wallBody = new PhysicsBody(wall, PhysicsMotionType.STATIC, false, this._scene);
            wallBody.shape = wallShape;
            // wallBody.setMaterial({ friction: friction, restitution: restitution }); // Apply bounciness etc. - Incorrect API
        }

        // 3. Spinning Hexagonal Pillars (Animated Cylinders)
        const pillarRadius = 0.75;
        const pillarHeight = 3;
        const pillarPositions = [new Vector3(-arenaWidth / 4, 0, 0), new Vector3(arenaWidth / 4, 0, 0)];
        const pillarMat = new StandardMaterial("pillarMat", this._scene);
        pillarMat.diffuseColor = new Color3(0.8, 0.2, 0.8); // Magenta
        pillarMat.emissiveColor = new Color3(0.4, 0.1, 0.4);

        pillarPositions.forEach((pos, i) => {
            const pillar = CreateCylinder(`pillar_${i}`, { height: pillarHeight, diameter: pillarRadius * 2, tessellation: 6 }, this._scene);
            pillar.position = pos;
            pillar.material = pillarMat;

            // Pillar Physics (Animated Cylinder)
            const pillarShape = new PhysicsShapeCylinder(new Vector3(0, -pillarHeight / 2, 0), new Vector3(0, pillarHeight / 2, 0), pillarRadius, this._scene);
            pillarShape.material = { friction: 0.2, restitution: 0.5 }; // Set material properties on the shape
            const pillarBody = new PhysicsBody(pillar, PhysicsMotionType.ANIMATED, false, this._scene);
            pillarBody.shape = pillarShape;
            // pillarBody.setMaterial({ friction: 0.2, restitution: 0.5 }); // Incorrect API
            this._spinningPillars.push(pillar); // Keep track of mesh for rotation
        });

        // Add rotation logic to render loop (applies to mesh, physics body follows)
        const pillarSpinSpeed = 0.01;
        this._scene.onBeforeRenderObservable.add(() => {
            this._spinningPillars.forEach((pillar, i) => {
                // Rotate using quaternion to avoid gimbal lock issues if needed, though Y-axis is simple
                const rotationAxis = Vector3.Up();
                const angle = pillarSpinSpeed * (i % 2 === 0 ? 1 : -1); // Alternate spin direction
                const quat = Quaternion.RotationAxis(rotationAxis, angle);
                pillar.rotationQuaternion = pillar.rotationQuaternion ? pillar.rotationQuaternion.multiply(quat) : quat;

                // Physics body is ANIMATED, so it should follow the mesh transform automatically
            });
        });


        // 4. Floating Bubble Zones (Static Triggers)
        const bubbleZoneRadius = 1.5;
        const bubbleZonePositions = [
            new Vector3(0, 0, arenaHeight / 3),
            new Vector3(0, 0, -arenaHeight / 3),
            new Vector3(arenaWidth / 3, 0, 0),
            new Vector3(-arenaWidth / 3, 0, 0)
        ];

        bubbleZonePositions.forEach((pos, i) => {
            const zone = CreateSphere(`bubbleZone_${i}`, { diameter: bubbleZoneRadius * 2 }, this._scene);
            zone.position = pos;
            zone.isVisible = false; // Invisible trigger
            zone.isPickable = false;

            // Trigger Physics Shape (Static Sphere)
            const zoneShape = new PhysicsShapeSphere(Vector3.Zero(), bubbleZoneRadius, this._scene);
            // Set collision filter properties on the shape to act like a trigger
            // Group 1 = Default, Group 2 = Triggers (Example)
            zoneShape.filterMembershipMask = 2; // This shape belongs to group 2
            zoneShape.filterCollideMask = 0;    // This shape collides with nothing by default
            // Narwhals would need their mask set to collide with group 2 if using physics events for triggers

            const zoneBody = new PhysicsBody(zone, PhysicsMotionType.STATIC, false, this._scene);
            zoneBody.shape = zoneShape;
            // zoneBody.isTrigger = true; // Incorrect API for Havok plugin

            this._bubbleZones.push(zone); // Keep track of mesh for intersection checks
        });

        console.log("Starwhal Arena Creation Complete");
    }

    // --- Narwhal Creation ---
    // (No changes needed inside _createNarwhals itself)
    private _createNarwhals(numPlayers: number): void {
        console.log(`Creating ${numPlayers} Narwhals...`);
        const spawnDistance = Math.min(this._arenaWidth, this._arenaHeight) * 0.4; // Spawn near edge
        const colors = [
            new Color3(1, 0, 1), // Magenta
            new Color3(0, 1, 1), // Cyan
            new Color3(1, 1, 0), // Yellow
            new Color3(0, 1, 0)  // Green
        ];

        for (let i = 0; i < numPlayers; i++) {
            const angle = (i / numPlayers) * Math.PI * 2;
            const spawnX = spawnDistance * Math.cos(angle);
            const spawnZ = spawnDistance * Math.sin(angle);
            const startPos = new Vector3(spawnX, 0, spawnZ); // Y=0 for physics plane
            const color = colors[i % colors.length];

            const narwhal = new Narwhal(i, this._scene, startPos, color);
            this._narwhals.push(narwhal);
        }
        console.log("Starwhal Narwhal Creation Complete");
    }

    // --- Controls ---
    // (No changes needed inside _setupControls or _processInput)
    private _setupControls(): void {
        console.log("Setting up Controls...");
        this._scene.actionManager = new ActionManager(this._scene);

        // Key Down
        this._scene.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
                this._inputMap[evt.sourceEvent.key.toLowerCase()] = true;
            })
        );

        // Key Up
        this._scene.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
                this._inputMap[evt.sourceEvent.key.toLowerCase()] = false;
            })
        );

        // Alternative: Use scene.onKeyboardObservable (might be preferred)
        // this._scene.onKeyboardObservable.add((kbInfo) => {
        //     switch (kbInfo.type) {
        //         case KeyboardEventTypes.KEYDOWN:
        //             this._inputMap[kbInfo.event.key.toLowerCase()] = true;
        //             break;
        //         case KeyboardEventTypes.KEYUP:
        //             this._inputMap[kbInfo.event.key.toLowerCase()] = false;
        //             break;
        //     }
        // });

        console.log("Starwhal Controls Setup Complete. Use Arrow Keys for Player 1.");
    }

    // _processInput is now called via scene observable
    private _processInput(): void {
        if (this._narwhals.length === 0) return; // No narwhals to control

        const player1 = this._narwhals[0]; // Control the first narwhal

        // Player 1 Controls (Arrow Keys)
        let rotationTorque = Vector3.Zero();
        let thrustForce = Vector3.Zero();

        if (this._inputMap["arrowleft"]) {
            console.log("Input: Arrow Left Detected"); // DEBUG LOG
            rotationTorque = rotationTorque.add(new Vector3(0, -this.ROTATION_TORQUE, 0));
        }
        if (this._inputMap["arrowright"]) {
            console.log("Input: Arrow Right Detected"); // DEBUG LOG
            rotationTorque = rotationTorque.add(new Vector3(0, this.ROTATION_TORQUE, 0));
        }
        if (this._inputMap["arrowup"]) {
            // Thrust is applied along the narwhal's forward vector in its applyThrust method
            // We just need to signal the magnitude here (using Z component as convention)
            thrustForce = new Vector3(0, 0, this.THRUST_FORCE);
        }

        // Apply inputs if there are any
        if (rotationTorque.lengthSquared() > 0) {
            player1.applyRotation(rotationTorque);
        }
        if (thrustForce.lengthSquared() > 0) {
            player1.applyThrust(thrustForce);
        }

        // Add controls for Player 2 (e.g., WASD) if needed
        // if (this._narwhals.length > 1) {
        //     const player2 = this._narwhals[1];
        //     let p2Rotation = Vector3.Zero();
        //     let p2Thrust = Vector3.Zero();
        //     if (this._inputMap["a"]) { p2Rotation = p2Rotation.add(new Vector3(0, -this.ROTATION_TORQUE, 0)); }
        //     if (this._inputMap["d"]) { p2Rotation = p2Rotation.add(new Vector3(0, this.ROTATION_TORQUE, 0)); }
        //     if (this._inputMap["w"]) { p2Thrust = new Vector3(0, 0, this.THRUST_FORCE); }
        //     if (p2Rotation.lengthSquared() > 0) { player2.applyRotation(p2Rotation); }
        //     if (p2Thrust.lengthSquared() > 0) { player2.applyThrust(p2Thrust); }
        // }
    }


    // --- Game Logic ---
    private _setupCollisionLogic(): void {
        console.log("Setting up Starwhal Collision Logic...");

        // Ensure impostors exist before registering collisions
        // Use a small delay or executeWhenReady if impostors aren't immediately available
        this._scene.executeWhenReady(() => {
            console.log("Executing collision registration logic...");
            if (this._narwhals.length < 2) {
                console.warn("Need at least 2 narwhals for collision setup.");
                return;
            }

            // Use observables on the Physics Bodies for collisions
            this._narwhals.forEach(narwhal => {
                // Observe collisions involving the heart body
                narwhal.heartBody.getCollisionObservable().add((event) => {
                    // event.collidedAgainst.transformNode is the TransformNode of the other body
                    const otherNode = event.collidedAgainst.transformNode;
                    // Find which narwhal's tusk this node belongs to
                    const attacker = this._narwhals.find(n => n.tusk === otherNode);

                    if (attacker && narwhal.lives > 0) { // Check if the collision was with a tusk and victim is alive
                         console.log(`Collision Callback: Tusk ${attacker.id} hit Heart ${narwhal.id}`);
                         narwhal.takeHit();
                         const direction = narwhal.mesh.position.subtract(attacker.mesh.position).normalize();
                         // Apply impulse to the main body (_body)
                         narwhal.getBody().applyImpulse(direction.scale(2), narwhal.mesh.getAbsolutePosition());
                    }
                });

                // Optional: Observe collisions involving the tusk body if needed for other effects
                // narwhal.tuskBody.getCollisionObservable().add((event) => { ... });
            });

            console.log("Starwhal Collision Logic Setup Complete.");
        }); // End executeWhenReady
    } // End _setupCollisionLogic

    // _applyBubbleZoneForces is now called via scene observable
    private _applyBubbleZoneForces(): void {
        const forceMagnitude = 0.5;

        this._narwhals.forEach(narwhal => {
            if (narwhal.lives <= 0) return;

            const narwhalBody = narwhal.getBody(); // Get the main physics body

            this._bubbleZones.forEach(zoneMesh => {
                // Use intersectsMesh with the narwhal's *core mesh* for zone detection
                if (narwhal.mesh.intersectsMesh(zoneMesh, false)) {
                    // Apply a random gentle force to the main physics body
                    const randomX = (Math.random() - 0.5) * 2 * forceMagnitude;
                    const randomZ = (Math.random() - 0.5) * 2 * forceMagnitude;
                    const force = new Vector3(randomX, 0, randomZ);

                    narwhalBody.applyForce(force, narwhal.mesh.getAbsolutePosition());
                }
            });
        });
    }

    // Placeholder for round management (checking win conditions, restarting)
    private _checkRoundEnd(): void {
        const aliveNarwhals = this._narwhals.filter(n => n.lives > 0);
        if (aliveNarwhals.length <= 1) {
            console.log("Round Over!");
            if (aliveNarwhals.length === 1) {
                console.log(`Winner: Narwhal ${aliveNarwhals[0].id}`);
            } else {
                console.log("It's a draw!");
            }
            // TODO: Implement restart logic or transition
            // this._engine.stopRenderLoop(); // Example: Stop the game
        }
        // TODO: Add timer logic if needed
    }


    // --- Public Accessors ---
    public getScene(): Scene {
        return this._scene;
    }
}
