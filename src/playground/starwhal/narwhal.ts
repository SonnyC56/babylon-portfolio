import * as BABYLON from '@babylonjs/core';
import { MeshBuilder, Scene, Vector3, Color3, Mesh, StandardMaterial, Quaternion, TransformNode, CreateTube, PhysicsBody, PhysicsShapeBox, PhysicsShapeSphere, PhysicsMotionType, PhysicsShape } from '@babylonjs/core'; // Explicitly import MeshBuilder and others needed directly
import "@babylonjs/core/Meshes/meshBuilder"; // Keep for runtime side effects

export class Narwhal {
    private _scene: Scene; // Use direct import type
    public id: number;
    public mesh: Mesh; // Use direct import type
    public tusk: Mesh; // Use direct import type
    public heart: Mesh; // Use direct import type
    private _visualBody: Mesh; // Use direct import type
    private _bodySegments: Vector3[] = []; // Use direct import type
    private _segmentLength = 0.2; // Distance between visual body points
    private _numSegments = 15; // Number of points in the visual body
    private _lagFactor = 0.85;
    public lives: number = 5;
    private _body: PhysicsBody; // Use direct import type
    public tuskBody: PhysicsBody; // Use direct import type
    public heartBody: PhysicsBody; // Use direct import type

    // Materials
    private _bodyMat: StandardMaterial; // Use direct import type
    private _tuskMat: StandardMaterial; // Use direct import type
    private _heartMat: StandardMaterial; // Use direct import type

    constructor(id: number, scene: Scene, startPos: Vector3, color: Color3) { // Use direct import types
        this.id = id;
        this._scene = scene;

        // --- Materials ---
        this._bodyMat = new StandardMaterial(`narwhalBodyMat_${id}`, scene); // Use direct import type
        this._bodyMat.diffuseColor = color;
        this._bodyMat.emissiveColor = color.scale(0.5); // Make it glow slightly
        this._bodyMat.specularColor = Color3.Black(); // Use direct import type

        this._tuskMat = new StandardMaterial(`narwhalTuskMat_${id}`, scene); // Use direct import type
        this._tuskMat.diffuseColor = Color3.White(); // Use direct import type
        this._tuskMat.emissiveColor = new Color3(0.8, 0.8, 0.8); // Use direct import type

        this._heartMat = new StandardMaterial(`narwhalHeartMat_${id}`, scene); // Use direct import type
        this._heartMat.diffuseColor = Color3.Red(); // Use direct import type
        this._heartMat.emissiveColor = new Color3(1, 0.2, 0.2); // Use direct import type

        // --- Core Physics Body ---
        // Using a sphere for simplicity, capsule might be better later
        this.mesh = MeshBuilder.CreateSphere(`narwhalCore_${id}`, { diameter: 1 }, scene); // Use direct MeshBuilder
        this.mesh.position = startPos;
        this.mesh.isVisible = true; // Make core mesh visible for debugging

        // --- Physics Body (Core) ---
        const coreShape = new PhysicsShapeSphere(Vector3.Zero(), 0.5, scene); // Use direct import types
        this._body = new PhysicsBody(this.mesh, PhysicsMotionType.DYNAMIC, false, scene); // Use direct import types
        this._body.shape = coreShape;
        this._body.setMassProperties({ mass: 1 });
        // Adjust friction/restitution via materials or directly on body if needed later
        // Remove setAngularFactor - rely on applying torque only on Y axis
        // Set linear/angular damping if needed for feel
        this._body.setLinearDamping(0.1);
        this._body.setAngularDamping(0.1); // Keep angular damping for stability


        // --- Tusk ---
        const tuskHeight = 1.5;
        const tuskDiameterBottom = 0.3;
        this.tusk = MeshBuilder.CreateTube(`narwhalTusk_${id}`, { radius: tuskDiameterBottom * 0.5, path: [new Vector3(0, 0, 0), new Vector3(0, 0, tuskHeight)] }, scene); // Use direct MeshBuilder
        this.tusk.material = this._tuskMat;
        this.tusk.setParent(this.mesh);
        this.tusk.position = new Vector3(0, 0, 0.7); // Use direct import type
        this.tusk.rotation.x = Math.PI / 2;

        // --- Physics Body (Tusk - for collision) ---
        // Use a simpler shape like a box or capsule aligned with the cone for collision
        // Using a box slightly smaller than the visual cone
        const tuskCollisionShape = new PhysicsShapeBox( // Use direct import type
            new Vector3(0, 0, tuskHeight / 2), // Center offset along tusk length // Use direct import type
            Quaternion.Identity(), // No rotation relative to parent // Use direct import type
            new Vector3(tuskDiameterBottom * 0.8, tuskDiameterBottom * 0.8, tuskHeight), // Extents // Use direct import type
            scene
        );
        // Create a *separate* PhysicsBody for the tusk, parented to the main body's transform node (this.mesh)
        // This body will be kinematic or static, just for triggering collisions.
        // Alternatively, keep it dynamic but constrained if complex interactions are needed.
        // Use ANIMATED for kinematic bodies moved by code/parenting
        this.tuskBody = new PhysicsBody(this.tusk, PhysicsMotionType.ANIMATED, false, scene); // Use direct import types
        this.tuskBody.shape = tuskCollisionShape;
        // ANIMATED bodies don't need mass properties set typically.
        // Set collision group/mask if needed later for filtering


        // --- Heart ---
        const heartDiameter = 0.4;
        this.heart = MeshBuilder.CreateSphere(`narwhalHeart_${id}`, { diameter: heartDiameter }, scene); // Use direct MeshBuilder
        this.heart.material = this._heartMat;
        this.heart.setParent(this.mesh);
        this.heart.position = new Vector3(0, 0, -0.3); // Use direct import type

        // --- Physics Body (Heart - for collision) ---
        const heartShape = new PhysicsShapeSphere(Vector3.Zero(), heartDiameter / 2, scene); // Use direct import types
        this.heartBody = new PhysicsBody(this.heart, PhysicsMotionType.ANIMATED, false, scene); // Use direct import types
        this.heartBody.shape = heartShape;
        // Set collision group/mask if needed later


        // --- Simulated Soft Body ---
        // Initialize segment positions trailing behind the start position
        const initialDirection = Vector3.Forward(); // Assuming starts facing forward // Use direct import type
        for (let i = 0; i < this._numSegments; i++) {
            this._bodySegments.push(startPos.subtract(initialDirection.scale(i * this._segmentLength)));
        }

        // Create the initial tube mesh
        this._visualBody = CreateTube(`narwhalVisual_${id}`, { // Use direct CreateTube
            path: this._bodySegments,
            radius: 0.2,
            sideOrientation: Mesh.DOUBLESIDE, // Use direct import type
            updatable: true
        }, scene);
        this._visualBody.material = this._bodyMat;
        this._visualBody.isPickable = false; // Don't interact with pointer
    }

    // --- Update Loop ---
    public update(): void {
        // Update simulated soft body
        this._updateVisualBody();
    }

    private _updateVisualBody(): void {
        if (!this.mesh || !this._visualBody) return;

        // Head segment follows the core physics body's position and orientation
        const headPos = this.mesh.getAbsolutePosition();
        const forwardDir = this.mesh.forward.normalize().scale(-1); // Get the actual forward direction

        this._bodySegments[0] = headPos;

        // Update subsequent segments based on the one before it
        for (let i = 1; i < this._numSegments; i++) {
            const prevSegment = this._bodySegments[i - 1];
            const currentSegment = this._bodySegments[i];

            // Direction from current to previous segment
            const dirToPrev = prevSegment.subtract(currentSegment).normalize();

            // Target position: previous segment minus segment length along the direction
            const targetPos = prevSegment.subtract(dirToPrev.scale(this._segmentLength));

            // Interpolate towards the target position for smooth lagging effect
            this._bodySegments[i] = Vector3.Lerp(currentSegment, targetPos, 1.0 - this._lagFactor); // Lerp towards target // Use direct import type
        }

        // Update the Tube mesh geometry
        // Pass the original name when updating the instance
        this._visualBody = CreateTube(this._visualBody.name, { // Use direct CreateTube
            path: this._bodySegments,
            instance: this._visualBody // Update existing instance
        }, this._scene); // Need to pass scene context when updating
    }

    // --- Control Methods ---
    public applyRotation(angularImpulse: Vector3): void { // Use direct import type
        console.log(`Narwhal ${this.id}: Applying Angular Impulse:`, angularImpulse); // DEBUG LOG
        // Apply angular impulse to the main physics body
        this._body.applyAngularImpulse(angularImpulse); // Correct method name
    }

    public applyThrust(force: Vector3): void { // Use direct import type
        // Apply force in the direction the core body is facing
        const worldForceDirection = this.mesh.forward.normalize().scale(-1); // Get world forward direction
        const forceMagnitude = force.z; // Use Z component convention from StarwhalScene
        const worldForce = worldForceDirection.scale(forceMagnitude);

        this._body.applyForce(worldForce, this.mesh.getAbsolutePosition());
    }

    // --- Gameplay ---
    public takeHit(): void {
        this.lives--;
        console.log(`Narwhal ${this.id} hit! Lives remaining: ${this.lives}`);
        // Add visual feedback (e.g., flash heart)
        this._flashMesh(this.heart, Color3.White(), 3); // Use direct import type

        if (this.lives <= 0) {
            this.destroy();
        }
    }

    private _flashMesh(mesh: Mesh, color: Color3, flashes: number): void { // Use direct import types
        const originalColor = (mesh.material as StandardMaterial).emissiveColor.clone(); // Use direct import type
        const flashColor = color;
        let count = 0;
        const interval = setInterval(() => {
            if (count % 2 === 0) {
                (mesh.material as StandardMaterial).emissiveColor = flashColor; // Use direct import type
            } else {
                (mesh.material as StandardMaterial).emissiveColor = originalColor; // Use direct import type
            }
            count++;
            if (count >= flashes * 2) {
                clearInterval(interval);
                (mesh.material as StandardMaterial).emissiveColor = originalColor; // Ensure it ends on original // Use direct import type
            }
        }, 100); // Flash duration
    }


    public destroy(): void {
        console.log(`Narwhal ${this.id} destroyed!`);
        // Dispose physics bodies first
        if (this._body) this._body.dispose();
        if (this.tuskBody) this.tuskBody.dispose();
        if (this.heartBody) this.heartBody.dispose();
        // Then dispose meshes
        this.mesh.dispose();
        this.tusk.dispose();
        if (this.heart) this.heart.dispose(); // Check if heart exists before disposing
        if (this._visualBody) this._visualBody.dispose(); // Check if visual body exists
        // Scene cleanup (removing from arrays) should happen in StarwhalScene
    }

    // Provide access to the main physics body
    public getBody(): PhysicsBody { // Use direct import type
        return this._body;
    }
}
