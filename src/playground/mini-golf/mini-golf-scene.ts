import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";

import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PointerInfo, PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { KeyboardInfo, KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents"; // Correct import path
import { LinesMesh } from "@babylonjs/core/Meshes/linesMesh";
import { ActionManager, ExecuteCodeAction } from "@babylonjs/core/Actions"; // Import ActionManager etc.
// GUI Imports
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Rectangle } from "@babylonjs/gui/2D/controls/rectangle";
import { Checkbox } from "@babylonjs/gui/2D/controls/checkbox";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { ScrollViewer } from "@babylonjs/gui/2D/controls/scrollViewers/scrollViewer"; // Import ScrollViewer
import { Grid } from "@babylonjs/gui/2D/controls/grid"; // Import Grid


// Side effects
import "@babylonjs/core/Physics/physicsEngineComponent";
// Need GUI side effects? Check documentation if needed.
import "@babylonjs/gui";

// Import CourseGenerator and HoleData
import { CourseGenerator, HoleData } from "./course-generator";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

// TODO: Import GUI elements, etc. later

export class MiniGolfScene {
    // scene and engine are now injected via constructor parameter properties
    private camera: ArcRotateCamera;
    private light: HemisphericLight;
    // havokInstance might not be needed if physics is truly global
    // private havokInstance: any; // Type appropriately if Havok interface is defined
    private courseGenerator: CourseGenerator;
    private currentHoleData: HoleData | null = null;
    private ball: Mesh | null = null;
    private ballAggregate: PhysicsAggregate | null = null;
    private ballMaterial: StandardMaterial;

    // Game State
    private currentHoleNumber: number = 1; // Start at hole 1
    private totalHoles: number = 18; // Match example
    private strokes: number = 0;
    private strokesPerHole: (number | null)[] = []; // Store strokes per hole (null if not played)
    private canShoot: boolean = true;
    private ballIsMoving: boolean = false;
    private readonly speedThreshold = 0.1; // Speed below which the ball is considered stopped

    // Input State
    private isDragging: boolean = false;
    private startPointerPosition: { x: number, y: number } | null = null;
    private aimLine: LinesMesh | null = null;
    private readonly maxShotPower = 15; // Max impulse strength
    private inputMap: { [key: string]: boolean } = {}; // For keyboard input
    private allowDirectionalControl: boolean = true; // Default to enabled like example

    // GUI State
    private guiTexture: AdvancedDynamicTexture | null = null;
    private strokeCountText: TextBlock | null = null;
    private powerMeterRect: Rectangle | null = null;
    private powerFillRect: Rectangle | null = null;
    private directionalControlTogglePanel: StackPanel | null = null;
    private directionalControlCheckbox: Checkbox | null = null;
    private directionalControlLabel: TextBlock | null = null;
    private scorecardContainer: Rectangle | null = null;
    private scorecardScrollViewer: ScrollViewer | null = null;
    private scorecardGrid: Grid | null = null;
    // TODO: Add messages etc.

    // Ramp Boost State
    private lastBoostedRamp: Mesh | null = null;

    // Respawn State
    private lastShotPosition: Vector3 | null = null;
    private readonly outOfBoundsY = -10; // Y level below which the ball is considered out of bounds

    // Accept scene, canvas, and engine from app.ts
    constructor(private scene: Scene, private canvas: HTMLCanvasElement, private engine: Engine | WebGPUEngine) {
        // Engine and Scene are now provided, no need to create them here.
        // Physics is also initialized globally in app.ts, so remove local initialization.
        this._setupScene();
        // The main render loop is handled by app.ts, so remove _startGameLoop call from here.
    }

    // Removed _initializePhysics as it's handled globally

    private _setupScene(): void {
        this._setupMaterials();
        this._setupCamera();
        this._setupLight();

        // Instantiate CourseGenerator
        this.courseGenerator = new CourseGenerator(this.scene);

        // Create the first hole
        this._loadHole(this.currentHoleNumber);

        // Setup Input Handling
        this._setupInputHandling();

        // Setup GUI - Temporarily disabled due to errors
        // this._setupGUI();
    }

     private _setupMaterials(): void {
        this.ballMaterial = new StandardMaterial("ballMat", this.scene);
        this.ballMaterial.diffuseColor = Color3.White(); // Simple white ball for now
        // Could add texture later like in the example
    }

    private _setupCamera(): void {
        this.camera = new ArcRotateCamera("golfCam", -Math.PI / 2, Math.PI / 3, 20, Vector3.Zero(), this.scene);
        this.camera.attachControl(this.canvas, true);
        this.camera.lowerRadiusLimit = 2; // Allow closer zoom
        this.camera.upperRadiusLimit = 50;
        this.camera.wheelPrecision = 50; // Adjust zoom speed if needed
    }

    private _setupLight(): void {
        this.light = new HemisphericLight("golfLight", new Vector3(0, 1, 0), this.scene);
        this.light.intensity = 0.8;
    }

    private _loadHole(holeNumber: number): void {
        // TODO: Dispose previous hole assets if any (ground, obstacles, holeMesh, ball)
        if (this.ball) {
            this.ball.dispose();
            this.ball = null;
        }
         if (this.currentHoleData) {
            // Dispose all ground planes
            this.currentHoleData.groundPlanes.forEach(plane => plane.dispose());
            this.currentHoleData.holeMesh.dispose();
            this.currentHoleData.obstacles.forEach(obs => obs.dispose());
            this.currentHoleData = null;
        }


        // Create the new hole
        this.currentHoleData = this.courseGenerator.createHole(holeNumber);

        // Create the ball (which will also update the camera target)
        this._createBall(this.currentHoleData.startPosition);

        // Initialize last shot position for the new hole
        this.lastShotPosition = this.currentHoleData.startPosition.clone();
    }

     private _createBall(position: Vector3): void {
        const ballDiameter = 0.4; // Slightly smaller than hole diameter
        this.ball = MeshBuilder.CreateSphere("golfBall", { diameter: ballDiameter, segments: 32 }, this.scene);
        this.ball.position = position.clone(); // Start at the designated position
        this.ball.material = this.ballMaterial;

        // Add physics aggregate
        this.ballAggregate = new PhysicsAggregate(
            this.ball,
            PhysicsShapeType.SPHERE,
            { mass: 1, restitution: 0.6, friction: 0.5 }, // Adjust physics params as needed
            this.scene
        );

        // Apply damping to simulate rolling resistance
        if (this.ballAggregate.body) {
             this.ballAggregate.body.setLinearDamping(0.4);
             this.ballAggregate.body.setAngularDamping(0.4);
        } else {
            console.warn("Ball physics body not available immediately for damping setup.");
             // Optionally, set damping in a later frame or observable if needed
        }

        // Update camera target now that the ball is guaranteed to exist
        const ballPosition = this.ball.position; // No need for 'if (this.ball)' check here
        this.camera.setTarget(ballPosition.clone());
        this.camera.radius = 15; // Reset zoom level
        this.camera.alpha = -Math.PI / 2; // Reset rotation
        this.camera.beta = Math.PI / 3;
    }

    // --- Input Handling Methods ---

    private _setupInputHandling(): void {
        // Pointer Input (Mouse Drag)
        this.scene.onPointerObservable.add((pointerInfo) => {
            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERDOWN:
                    this._onPointerDown(pointerInfo);
                    break;
                case PointerEventTypes.POINTERMOVE:
                    this._onPointerMove(pointerInfo);
                    break;
                case PointerEventTypes.POINTERUP:
                    this._onPointerUp(pointerInfo);
                    break;
            }
        });

        // Keyboard Input (Directional Control)
        // Ensure scene has an action manager
        if (!this.scene.actionManager) {
            this.scene.actionManager = new ActionManager(this.scene);
        }

        this.scene.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
                const key = evt.sourceEvent.key.toLowerCase();
                if (key === "a" || key === "arrowleft" || key === "d" || key === "arrowright") {
                    this.inputMap[key] = true;
                    // console.log("Key down:", key); // Keep console clean
                }
            })
        );

        this.scene.actionManager.registerAction(
            new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
                const key = evt.sourceEvent.key.toLowerCase();
                 if (key === "a" || key === "arrowleft" || key === "d" || key === "arrowright") {
                    this.inputMap[key] = false;
                    // console.log("Key up:", key); // Keep console clean
                }
            })
        );
    }

    private _onPointerDown(pointerInfo: PointerInfo): void {
        // Check if we can shoot, if the ball exists, and if the click is on the ball
        const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
        if (!this.ball || !this.canShoot || this.ballIsMoving || !pickInfo?.hit || pickInfo.pickedMesh !== this.ball) {
            return; // Exit if not clicking the ball, cannot shoot, or ball is moving
        }

        // Check if it's the left mouse button
        if (pointerInfo.event.button !== 0) {
            return;
        }

        this.isDragging = true;
        this.startPointerPosition = { x: pointerInfo.event.clientX, y: pointerInfo.event.clientY };

        // Create or show aiming line
        this._updateAimLine(0, 0); // Initialize line at zero length

        // Show power meter
        if (this.powerMeterRect) this.powerMeterRect.isVisible = true;
        if (this.powerFillRect) this.powerFillRect.width = "0%"; // Reset fill

        // Prevent camera control while aiming
        this.camera.detachControl();
        // console.log("Aiming started"); // Keep console clean
    }

    private _onPointerMove(pointerInfo: PointerInfo): void {
        if (!this.isDragging || !this.startPointerPosition) {
            return;
        }

        const currentX = pointerInfo.event.clientX;
        const currentY = pointerInfo.event.clientY;
        const deltaX = currentX - this.startPointerPosition.x;
        const deltaY = currentY - this.startPointerPosition.y;

        // Update aiming line visualization
        this._updateAimLine(deltaX, deltaY);

        // Update power meter GUI
        const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const powerRatio = Math.min(dragDistance * 0.05 / this.maxShotPower, 1.0); // Use same scaling as shot power for consistency
        if (this.powerFillRect) {
            this.powerFillRect.width = `${powerRatio * 100}%`;
        }
    }

     private _onPointerUp(pointerInfo: PointerInfo): void {
        if (!this.isDragging || !this.startPointerPosition || !this.ball || !this.ballAggregate?.body) {
            this.isDragging = false; // Ensure dragging stops even if we can't shoot
            // Re-attach camera controls (it's safe to call even if already attached)
            this.camera.attachControl(this.canvas, true);
            // Hide aim line if it exists
             if (this.aimLine) {
                this.aimLine.isVisible = false;
            }
            return;
        }

         // Check if it's the left mouse button release
        if (pointerInfo.event.button !== 0) {
             // Hide power meter if aiming is cancelled early (e.g., right-click)
            if (this.powerMeterRect) this.powerMeterRect.isVisible = false;
            return;
        }

        const endX = pointerInfo.event.clientX;
        const endY = pointerInfo.event.clientY;
        const deltaX = endX - this.startPointerPosition.x;
        const deltaY = endY - this.startPointerPosition.y;

        // Calculate shot direction based on camera orientation and drag delta
        const cameraForward = this.camera.getForwardRay().direction;
        // Use scene.activeCamera which should be the ArcRotateCamera in this case
        const cameraRight = Vector3.Cross(this.scene.activeCamera!.upVector, cameraForward).normalize();

        // Direction is opposite to drag, projected onto XZ plane
        let shotDirection = cameraRight.scale(-deltaX).add(cameraForward.scale(-deltaY));
        shotDirection.y = 0; // Project onto ground plane
        shotDirection.normalize();

        // Calculate power based on drag distance
        const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const power = Math.min(dragDistance * 0.05, this.maxShotPower); // Scale factor needs tuning

        if (power > 0.1) { // Only shoot if power is significant
            // Store position BEFORE applying impulse
            this.lastShotPosition = this.ball.position.clone();

            const impulse = shotDirection.scale(power);
            this.ballAggregate.body.applyImpulse(impulse, this.ball.getAbsolutePosition());

            this.strokes++;
            this.canShoot = false; // Prevent shooting until ball stops
            this.ballIsMoving = true;
            console.log(`Shot fired! Power: ${power.toFixed(2)}, Strokes: ${this.strokes}`);
            // this._updateStrokeCountGUI(); // Update GUI after stroke - Temporarily disabled
        }

        // Cleanup aiming state
        this.isDragging = false;
        this.startPointerPosition = null;
        if (this.aimLine) {
            this.aimLine.isVisible = false;
        }
        // Re-attach camera controls
        this.camera.attachControl(this.canvas, true);

        // Hide power meter after shot or cancellation
        if (this.powerMeterRect) this.powerMeterRect.isVisible = false;
    }

    private _updateAimLine(deltaX: number, deltaY: number): void {
         if (!this.ball || !this.scene.activeCamera) return; // Need ball and active camera

        const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        // Use a slightly different scaling for visual length vs power calculation
        const powerRatio = Math.min(dragDistance * 0.05 / this.maxShotPower, 1.0);
        const lineLength = powerRatio * 5; // Max visual length of the line

        // Calculate direction based on camera (similar to _onPointerUp)
        const cameraForward = this.camera.getForwardRay().direction;
        const cameraRight = Vector3.Cross(this.scene.activeCamera.upVector, cameraForward).normalize();
        let aimDirection = cameraRight.scale(-deltaX).add(cameraForward.scale(-deltaY));
        aimDirection.y = 0; // Project onto ground plane
        aimDirection.normalize();

        const startPoint = this.ball.position.add(new Vector3(0, 0.1, 0)); // Slightly above ball
        const endPoint = startPoint.add(aimDirection.scale(lineLength));

        if (!this.aimLine) {
            this.aimLine = MeshBuilder.CreateLines("aimLine", {
                points: [startPoint, endPoint],
                updatable: true
            }, this.scene);
            this.aimLine.color = Color3.Yellow();
        } else {
            // Update existing line instance
            this.aimLine = MeshBuilder.CreateLines("aimLine", {
                points: [startPoint, endPoint],
                instance: this.aimLine
            });
            this.aimLine.isVisible = true; // Ensure it's visible if it was hidden
        }
    }

    // --- Game Logic Methods ---

    private _checkBallState(): void {
        if (!this.ball || !this.ballAggregate?.body || !this.currentHoleData) {
            return;
        }

        const velocity = this.ballAggregate.body.getLinearVelocity();
        const speed = velocity.length();

        if (this.ballIsMoving && speed < this.speedThreshold) {
            // Ball has stopped moving
            this.ballIsMoving = false;
            this.canShoot = true;
            // Optional: Fully stop the ball if speed is very low
            this.ballAggregate.body.setLinearVelocity(Vector3.Zero());
            this.ballAggregate.body.setAngularVelocity(Vector3.Zero());
            console.log("Ball stopped. Can shoot again.");
        } else if (!this.ballIsMoving && speed >= this.speedThreshold) {
             // Ball started moving (e.g., after shot)
             this.ballIsMoving = true;
             this.canShoot = false;
        }

        // Check if ball is in the hole
        const distanceToHole = Vector3.Distance(this.ball.position, this.currentHoleData.holePosition);
        const holeRadius = 0.25; // Match hole mesh diameter / 2
        // Check XZ distance and Y position separately for better accuracy - Increased Y tolerance
        if (distanceToHole < holeRadius && Math.abs(this.ball.position.y - this.currentHoleData.holePosition.y) < 0.3) { // Increased Y tolerance from 0.2 to 0.3
             console.log("Ball in hole!");
             this._handleHoleComplete();
        }

        // Check for ramp intersection and apply boost
        let currentlyIntersectingRamp: Mesh | null = null;
        if (this.currentHoleData.ramps && this.currentHoleData.ramps.length > 0) {
            for (const ramp of this.currentHoleData.ramps) {
                if (this.ball.intersectsMesh(ramp, false)) {
                    currentlyIntersectingRamp = ramp;
                    if (this.lastBoostedRamp !== ramp) {
                        // Apply boost only once per ramp entry
                        const currentVelocity = this.ballAggregate.body.getLinearVelocity();
                        this.ballAggregate.body.setLinearVelocity(currentVelocity.scale(3)); // 3x boost like example
                        console.log("Ramp boost applied!");
                        this.lastBoostedRamp = ramp; // Mark this ramp as the booster
                    }
                    break; // Assume ball can only be on one ramp at a time
                }
            }
        }

        // Reset boost flag if ball is no longer on the ramp it was boosted by
        if (this.lastBoostedRamp && currentlyIntersectingRamp !== this.lastBoostedRamp) {
            this.lastBoostedRamp = null;
        }

        // Check if ball is out of bounds
        if (this.ball.position.y < this.outOfBoundsY) {
            console.log("Ball out of bounds! Respawning...");
            this._respawnBall();
            return; // Skip other checks for this frame after respawn
        }

        // Apply directional impulses based on input and toggle state
        if (this.allowDirectionalControl && this.ballIsMoving && speed > (this.speedThreshold * 10)) { // Only apply if moving reasonably fast
            const forceMagnitude = 10.0; // Match example force
            let forceDirection = Vector3.Zero();
            let isAnyKeyPressed = false;

            // Get current velocity direction (XZ plane)
            const movementDirection = velocity.clone();
            movementDirection.y = 0;
            movementDirection.normalize();

            // Check keys and calculate perpendicular force direction
            if (this.inputMap["a"] || this.inputMap["arrowleft"]) {
                // Apply force to the left relative to movement
                const left = new Vector3(-movementDirection.z, 0, movementDirection.x);
                forceDirection = forceDirection.add(left);
                isAnyKeyPressed = true;
            }
            if (this.inputMap["d"] || this.inputMap["arrowright"]) {
                // Apply force to the right relative to movement
                const right = new Vector3(movementDirection.z, 0, -movementDirection.x);
                forceDirection = forceDirection.add(right);
                isAnyKeyPressed = true;
            }

            if (isAnyKeyPressed) {
                forceDirection.normalize(); // Ensure consistent force magnitude
                const force = forceDirection.scale(forceMagnitude);
                this.ballAggregate.body.applyForce(force, this.ball.getAbsolutePosition());
                // console.log("Applying directional force:", force); // Keep console clean
            }
        }
    }

     private _respawnBall(): void {
        if (!this.ball || !this.ballAggregate?.body || !this.lastShotPosition) {
            console.error("Cannot respawn ball: Missing ball, physics body, or last shot position.");
            // As a fallback, maybe try respawning at hole start?
            if (this.currentHoleData) {
                 this.lastShotPosition = this.currentHoleData.startPosition.clone();
            } else {
                return; // Cannot respawn
            }
        }

        // Apply penalty stroke
        this.strokes++;
        // this._updateStrokeCountGUI(); // Temporarily disabled

        // Reset physics state (with null checks)
        if (this.ballAggregate?.body) {
            this.ballAggregate.body.setLinearVelocity(Vector3.Zero());
            this.ballAggregate.body.setAngularVelocity(Vector3.Zero());
        }

        // Reset mesh position (important to do AFTER resetting physics, with null checks)
        if (this.ball && this.lastShotPosition) {
            this.ball.position.copyFrom(this.lastShotPosition);
        }

        // Reset game state flags
        this.ballIsMoving = false;
        this.canShoot = true;
        this.lastBoostedRamp = null; // Reset boost state on respawn
    }


    private _handleHoleComplete(): void {
         // Prevent further actions for this hole
         this.canShoot = false;
         this.ballIsMoving = false;
         if (this.ballAggregate?.body) {
             // Stop the ball completely
             this.ballAggregate.body.setLinearVelocity(Vector3.Zero());
             this.ballAggregate.body.setAngularVelocity(Vector3.Zero());
         }
         if (this.ball) this.ball.isVisible = false; // Hide ball

         // Placeholder: Load next hole after a delay
         console.log(`Hole ${this.currentHoleNumber} complete in ${this.strokes} strokes.`);
         // TODO: Update scorecard GUI

         setTimeout(() => {
             this.currentHoleNumber++;
             // TODO: Check if game over (e.g., currentHoleNumber > totalHoles)
             this.strokes = 0; // Reset strokes for next hole
             this.lastBoostedRamp = null; // Reset boost state for new hole
             // this._updateStrokeCountGUI(); // Update GUI for new hole - Temporarily disabled
             this._loadHole(this.currentHoleNumber);
             this.canShoot = true; // Allow shooting on new hole
             if (this.ball) this.ball.isVisible = true; // Make sure new ball is visible
         }, 2000); // 2 second delay
    }

    // --- GUI Methods ---

    private _setupGUI(): void {
        // Explicitly pass the scene instance
        //create new dyanmic texture for GUIe
        this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);

        this.strokeCountText = new TextBlock("strokeCount");
        this.strokeCountText.text = `Hole: ${this.currentHoleNumber} - Strokes: ${this.strokes}`;
        this.strokeCountText.color = "white";
        this.strokeCountText.fontSize = 24;
        this.strokeCountText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.strokeCountText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.strokeCountText.paddingTop = "20px";
        this.strokeCountText.paddingLeft = "20px";
        this.guiTexture.addControl(this.strokeCountText);

        // Create Power Meter Background
        this.powerMeterRect = new Rectangle("powerMeter");
        this.powerMeterRect.width = "200px";
        this.powerMeterRect.height = "20px";
        this.powerMeterRect.cornerRadius = 10;
        this.powerMeterRect.color = "black"; // Border color
        this.powerMeterRect.thickness = 2;
        this.powerMeterRect.background = "rgba(255, 255, 255, 0.5)"; // Semi-transparent white
        this.powerMeterRect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.powerMeterRect.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.powerMeterRect.top = "140px"; // Position from top like example
        this.powerMeterRect.isVisible = false; // Hidden by default
        this.guiTexture.addControl(this.powerMeterRect);

        // Create Power Meter Fill
        this.powerFillRect = new Rectangle("powerFill");
        this.powerFillRect.width = "0%"; // Start empty
        this.powerFillRect.height = "100%"; // Fill height of parent
        this.powerFillRect.cornerRadius = 8; // Slightly smaller corner radius
        this.powerFillRect.background = "green";
        this.powerFillRect.color = "transparent"; // No border for fill
        this.powerFillRect.thickness = 0;
        this.powerFillRect.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT; // Align left within parent
        this.powerFillRect.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.powerMeterRect.addControl(this.powerFillRect); // Add fill inside the background

        // Create Directional Control Toggle
        this.directionalControlTogglePanel = new StackPanel("dirControlPanel");
        this.directionalControlTogglePanel.isVertical = false; // Arrange checkbox and label horizontally
        this.directionalControlTogglePanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.directionalControlTogglePanel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.directionalControlTogglePanel.width = "250px"; // Adjust width as needed
        this.directionalControlTogglePanel.height = "40px";
        this.directionalControlTogglePanel.top = "70px"; // Position below stroke counter
        this.directionalControlTogglePanel.paddingRight = "20px"; // Use paddingRight for spacing from edge
        this.guiTexture.addControl(this.directionalControlTogglePanel);

        this.directionalControlCheckbox = new Checkbox("dirControlCheckbox");
        this.directionalControlCheckbox.width = "20px";
        this.directionalControlCheckbox.height = "20px";
        this.directionalControlCheckbox.isChecked = this.allowDirectionalControl; // Set initial state
        this.directionalControlCheckbox.color = "white";
        this.directionalControlCheckbox.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.directionalControlCheckbox.onIsCheckedChangedObservable.add((value) => {
            this.allowDirectionalControl = value;
            console.log("Directional Control Toggled:", this.allowDirectionalControl);
        });
        this.directionalControlTogglePanel.addControl(this.directionalControlCheckbox);

        this.directionalControlLabel = new TextBlock("dirControlLabel", "Enable Directional Control");
        this.directionalControlLabel.color = "white";
        this.directionalControlLabel.fontSize = 16;
        this.directionalControlLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.directionalControlLabel.paddingLeft = "10px"; // Space between checkbox and label
        this.directionalControlTogglePanel.addControl(this.directionalControlLabel);


        // TODO: Add Scorecard, Messages etc.
    }

    private _updateStrokeCountGUI(): void {
        if (this.strokeCountText) {
            this.strokeCountText.text = `Hole: ${this.currentHoleNumber} - Strokes: ${this.strokes}`;
        }
    }

    private _setupScorecardGUI(): void {
        if (!this.guiTexture) return;

        // Container for the scorecard
        this.scorecardContainer = new Rectangle("scorecardContainer");
        this.scorecardContainer.width = "150px"; // Adjust as needed
        this.scorecardContainer.height = "200px"; // Max height like example
        this.scorecardContainer.cornerRadius = 10;
        this.scorecardContainer.color = "black";
        this.scorecardContainer.thickness = 2;
        this.scorecardContainer.background = "rgba(255, 255, 255, 0.7)";
        this.scorecardContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.scorecardContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.scorecardContainer.top = "70px"; // Position below stroke counter
        this.scorecardContainer.left = "20px";
        this.guiTexture.addControl(this.scorecardContainer);

        // ScrollViewer to handle overflow if many holes
        this.scorecardScrollViewer = new ScrollViewer("scorecardScroll");
        this.scorecardScrollViewer.width = "100%";
        this.scorecardScrollViewer.height = "100%";
        this.scorecardScrollViewer.barSize = 10;
        this.scorecardScrollViewer.color = "grey"; // Scrollbar color
        this.scorecardContainer.addControl(this.scorecardScrollViewer);

        // Grid to hold the scores
        this.scorecardGrid = new Grid("scorecardGrid");
        this.scorecardGrid.width = "100%";
        // Height will adapt, add rows dynamically
        this.scorecardGrid.addColumnDefinition(0.5); // 50% width for Hole #
        this.scorecardGrid.addColumnDefinition(0.5); // 50% width for Strokes
        // Header Row
        this.scorecardGrid.addRowDefinition(30, true); // 30px height for header (pixels)
        const headerHole = new TextBlock("headerHole", "Hole");
        headerHole.color = "black";
        headerHole.fontWeight = "bold";
        this.scorecardGrid.addControl(headerHole, 0, 0); // Row 0, Col 0
        const headerStrokes = new TextBlock("headerStrokes", "Strokes");
        headerStrokes.color = "black";
        headerStrokes.fontWeight = "bold";
        this.scorecardGrid.addControl(headerStrokes, 0, 1); // Row 0, Col 1

        this.scorecardScrollViewer.addControl(this.scorecardGrid);

        // Initial population
        this._updateScorecardGUI();
    }

    private _updateScorecardGUI(): void {
        if (!this.scorecardGrid) return;

        // --- Clear existing score rows (keeping the header) ---

        // --- Clear existing score rows (keeping the header) ---

        // 1. Remove controls from score rows (any control not named starting with "header")
        const childrenToRemove = this.scorecardGrid.children.filter(control =>
            !control.name?.startsWith("header")
        );
        childrenToRemove.forEach(control => this.scorecardGrid!.removeControl(control));

        // 2. Remove row definitions for score rows (all except the first one)
        // Iterate backwards from last row definition down to the second one (index 1)
        while (this.scorecardGrid.rowCount > 1) {
             this.scorecardGrid.removeRowDefinition(this.scorecardGrid.rowCount - 1);
        }


        let totalStrokes = 0;
        // Add rows for each hole played + total
        for (let i = 0; i < this.totalHoles; i++) {
            const holeNum = i + 1;
            const strokes = this.strokesPerHole[i];
            const displayStrokes = strokes !== undefined && strokes !== null ? strokes.toString() : "-";
            totalStrokes += strokes || 0; // Add to total only if played

            // Add a new row definition for this hole
            this.scorecardGrid.addRowDefinition(25, true); // 25px height for score rows
            const gridRowIndex = holeNum; // Row index matches hole number (since header is row 0)

            const holeCell = new TextBlock(`hole_${holeNum}`, holeNum.toString());
            holeCell.color = "black";
            holeCell.height = "25px"; // Match row height
            this.scorecardGrid.addControl(holeCell, gridRowIndex, 0);

            const strokesCell = new TextBlock(`strokes_${holeNum}`, displayStrokes);
            strokesCell.color = "black";
            strokesCell.height = "25px"; // Match row height
            this.scorecardGrid.addControl(strokesCell, gridRowIndex, 1);
        }

        // Add Total Row
        this.scorecardGrid.addRowDefinition(30, true); // Slightly taller total row
        const totalRowIndex = this.totalHoles + 1;
        const totalLabel = new TextBlock("totalLabel", "Total");
        totalLabel.color = "black";
        totalLabel.fontWeight = "bold";
        totalLabel.height = "30px";
        this.scorecardGrid.addControl(totalLabel, totalRowIndex, 0);

        const totalStrokesCell = new TextBlock("totalStrokes", totalStrokes.toString());
        totalStrokesCell.color = "black";
        totalStrokesCell.fontWeight = "bold";
        totalStrokesCell.height = "30px";
        this.scorecardGrid.addControl(totalStrokesCell, totalRowIndex, 1);

    }

    // TODO: Add methods for other UI updates etc.

    private _startGameLoop(): void {
        this.engine.runRenderLoop(() => {
            this._checkBallState(); // Check ball state every frame
            this.scene.render();
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
        // Add scene-specific updates to the scene's render loop observable
        this.scene.onBeforeRenderObservable.add(() => {
             this._checkBallState(); // Check ball state every frame
        });
    }

    // Removed run() method as scene execution is managed by app.ts
    // Removed dispose() method for engine/scene as they are managed globally
    // Individual components created by this scene might need disposal if the scene is switched out.
    public cleanup(): void {
        // Dispose GUI, meshes, materials specific to this scene if needed for scene switching
        // this.guiTexture?.dispose(); // Temporarily disabled
        this.aimLine?.dispose();
        this.ball?.dispose(); // Includes aggregate implicitly? Check docs.
        if (this.currentHoleData) {
            // Dispose all ground planes
            this.currentHoleData.groundPlanes.forEach(plane => plane.dispose());
            this.currentHoleData.holeMesh.dispose();
            this.currentHoleData.obstacles.forEach(obs => obs.dispose());
            this.currentHoleData.ramps.forEach(ramp => ramp.dispose()); // Dispose ramps too
        }
        // Remove observables specific to this scene
        // (Pointer observable might need removal if scene switching is implemented)
        // TODO: Properly remove scene.onBeforeRenderObservable listener added in _startGameLoop
        // Dispose directional control GUI - Temporarily disabled
        // this.directionalControlTogglePanel?.dispose(); // Panel disposes children too
        console.log("MiniGolfScene cleaned up (basic)");
    }
}
