import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector"; // Import Quaternion
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType, PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin"; // Import MotionType

export interface HoleData {
    groundPlanes: Mesh[]; // Changed from single ground to array
    holeMesh: Mesh;
    holePosition: Vector3;
    startPosition: Vector3;
    obstacles: Mesh[];
    ramps: Mesh[]; // Add ramps to the data structure
}

export class CourseGenerator {
    private groundMaterial: StandardMaterial;
    private holeMaterial: StandardMaterial;
    private obstacleMaterial: StandardMaterial;
    private rampMaterial: StandardMaterial; // Add material for ramps

    constructor(private scene: Scene) {
        this._setupMaterials();
    }

    private _setupMaterials(): void {
        this.groundMaterial = new StandardMaterial("groundMat", this.scene);
        this.groundMaterial.diffuseColor = new Color3(0.2, 0.6, 0.2); // Greenish

        this.holeMaterial = new StandardMaterial("holeMat", this.scene);
        this.holeMaterial.diffuseColor = new Color3(0.1, 0.1, 0.1); // Dark grey/black

        this.obstacleMaterial = new StandardMaterial("obstacleMat", this.scene);
        this.obstacleMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5); // Grey obstacles

        this.rampMaterial = new StandardMaterial("rampMat", this.scene);
        this.rampMaterial.diffuseColor = new Color3(0.6, 0.3, 0); // Brownish ramp
    }

    public createHole(holeNumber: number): HoleData {
        const groundPlanes: Mesh[] = [];
        const obstacles: Mesh[] = [];
        const ramps: Mesh[] = []; // Initialize ramps array
        const planeSize = 100; // Size of each plane segment (Increased)
        const planeCount = Math.max(1, holeNumber); // At least one plane
        const planeHeightDifference = 30; // Vertical distance between planes (Increased)
        // const maxXZOffset = 15; // Max random offset for planes (Removed, using direct random offset)

        // Create multiple ground planes
        for (let i = 0; i < planeCount; i++) {
            const plane = MeshBuilder.CreateGround(`plane${i}`, { width: planeSize, height: planeSize }, this.scene);
            plane.position.y = i * planeHeightDifference;
            // Randomly offset planes in x and z directions (like example)
            plane.position.x = Math.random() * 200 - 100; // Random x position between -100 and 100
            plane.position.z = Math.random() * 200 - 100; // Random z position between -100 and 100
            plane.material = this.groundMaterial;
            new PhysicsAggregate(plane, PhysicsShapeType.BOX, { mass: 0, friction: 0.8, restitution: 0.3 }, this.scene);
            groundPlanes.push(plane);
        }

        // Place hole on the lowest plane (index 0)
        const lowestPlane = groundPlanes[0];
        // Ensure hole doesn't spawn inside potential obstacles (simple check for now)
        const holeXOffset = (Math.random() * (planeSize - 20)) - (planeSize / 2 - 10); // Avoid edges
        const holeZOffset = (Math.random() * (planeSize - 20)) - (planeSize / 2 - 10);
        const holePosition = lowestPlane.position.clone().add(new Vector3(holeXOffset, 0.05, holeZOffset));

        const holeMesh = MeshBuilder.CreateCylinder("hole", { diameter: 3.2, height: 0.1 }, this.scene); // Match example size
        holeMesh.position = holePosition;
        holeMesh.material = this.holeMaterial;

        // Place ball start on the highest plane (last index)
        const highestPlane = groundPlanes[groundPlanes.length - 1];
        // Ensure ball doesn't spawn inside potential obstacles (simple check for now)
        const ballXOffset = (Math.random() * (planeSize - 20)) - (planeSize / 2 - 10); // Avoid edges
        const ballZOffset = (Math.random() * (planeSize - 20)) - (planeSize / 2 - 10);
        const startPosition = highestPlane.position.clone().add(new Vector3(ballXOffset, 0.5, ballZOffset)); // Ball radius above ground

        // Add obstacles to each plane
        const totalObstacles = (10 + holeNumber * 5) * 3; // Match example obstacle count logic
        const obstaclesPerPlane = Math.ceil(totalObstacles / planeCount); // Distribute obstacles somewhat evenly

        groundPlanes.forEach((plane, index) => {
            for (let i = 0; i < obstaclesPerPlane; i++) {
                // Avoid placing obstacles too close to start/end points on the respective planes (keep this logic)
                const isStartPlane = index === groundPlanes.length - 1;
                const isEndPlane = index === 0;
                obstacles.push(this._createBlockObstacle(plane, planeSize, isStartPlane ? startPosition : null, isEndPlane ? holePosition : null));
            }
        });

        // Create ramps between planes (from higher to lower)
        for (let i = 0; i < groundPlanes.length - 1; i++) {
            const upperPlane = groundPlanes[i + 1];
            const lowerPlane = groundPlanes[i];
            const ramp = this._createLaunchRamp(upperPlane, lowerPlane, planeSize);
            ramps.push(ramp);
            // TODO: Add boost zone later if needed
        }

        return {
            groundPlanes: groundPlanes,
            holeMesh: holeMesh,
            holePosition: holePosition,
            startPosition: startPosition,
            obstacles: obstacles,
            ramps: ramps // Include ramps in returned data
        };
    }

    private _createBlockObstacle(plane: Mesh, planeSize: number, avoidPos1: Vector3 | null, avoidPos2: Vector3 | null): Mesh {
        const sizeX = Math.random() * 3 + 2; // Match example obstacle size range
        const sizeY = Math.random() * 2 + 1;
        const sizeZ = Math.random() * 3 + 2;
        const minAvoidDistance = 5; // Increase avoid distance slightly for larger planes

        let positionX, positionZ, positionY, obstaclePos;
        let tooClose = true;
        let attempts = 0;
        const maxAttempts = 20;

        // Try to find a position not too close to start/hole
        while (tooClose && attempts < maxAttempts) {
            // Place within plane bounds, avoiding edges slightly more
            positionX = plane.position.x + (Math.random() * (planeSize - sizeX - 10)) - ((planeSize - sizeX) / 2 - 5);
            positionZ = plane.position.z + (Math.random() * (planeSize - sizeZ - 10)) - ((planeSize - sizeZ) / 2 - 5);
            positionY = plane.position.y + sizeY / 2;
            obstaclePos = new Vector3(positionX, positionY, positionZ);

            let dist1 = avoidPos1 ? Vector3.Distance(obstaclePos, avoidPos1) : Infinity;
            let dist2 = avoidPos2 ? Vector3.Distance(obstaclePos, avoidPos2) : Infinity;

            if (dist1 > minAvoidDistance && dist2 > minAvoidDistance) {
                tooClose = false;
            }
            attempts++;
        }
         if (tooClose) {
             console.warn("Could not place obstacle far enough from start/hole, placing anyway.");
         }


        const block = MeshBuilder.CreateBox(`obstacle_${plane.name}_${Math.random().toString(36).substring(7)}`, {
            height: sizeY,
            width: sizeX,
            depth: sizeZ
        }, this.scene);
        block.position = obstaclePos!; // Use the calculated position
        block.rotation.y = Math.random() * Math.PI * 2; // Random rotation
        block.material = this.obstacleMaterial;

        new PhysicsAggregate(block, PhysicsShapeType.BOX, { mass: 0, friction: 0.6, restitution: 0.5 }, this.scene);

        return block;
    }

    private _createLaunchRamp(upperPlane: Mesh, lowerPlane: Mesh, planeSize: number): Mesh {
        const rampWidth = 10;
        const rampHeight = 2; // Match example
        const rampLength = 15; // Match example

        // Calculate the direction vector from the upper plane towards the lower plane's center
        const directionToLowerPlane = lowerPlane.position.subtract(upperPlane.position).normalize();

        // Calculate the position on the edge of the upper plane closest to the lower plane
        // We need a point on the upper plane's edge pointing towards the lower plane
        // Approximate edge position by moving half the plane size in the calculated direction
        // This might need refinement for precise edge placement on rotated planes, but is a good start
        const edgeOffset = planeSize / 2 - rampLength / 2; // Position ramp near the edge
        const rampPosition = upperPlane.position.add(directionToLowerPlane.scale(edgeOffset));
        rampPosition.y = upperPlane.position.y; // Start ramp at the upper plane's height

        const ramp = MeshBuilder.CreateBox("ramp", {
            width: rampWidth,
            height: rampHeight,
            depth: rampLength
        }, this.scene);

        ramp.position = rampPosition; // Set initial position before rotation adjustment

        // Calculate rotation to face the lower plane and incline downwards
        const yaw = Math.atan2(directionToLowerPlane.x, directionToLowerPlane.z);
        const pitch = -Math.PI / 9; // Approx 20 degrees downwards incline (match example)

        // Apply rotation using Quaternion for potentially better physics handling
        ramp.rotationQuaternion = Quaternion.RotationYawPitchRoll(yaw, pitch, 0);

        // Adjust position slightly based on rotation to ensure it sits correctly
        // (This might need fine-tuning depending on pivot point and desired placement)
        // For now, let's assume the pivot is center and adjust Y based on incline
        ramp.position.y -= (rampHeight / 2) * Math.cos(pitch) - (rampLength / 2) * Math.sin(Math.abs(pitch));


        ramp.material = this.rampMaterial;

        // Use BoxImpostor - Havok should handle rotated boxes correctly
        new PhysicsAggregate(ramp, PhysicsShapeType.BOX, { mass: 0, friction: 0.5, restitution: 0.5 }, this.scene);

        return ramp;
    }

    // TODO: Implement boost zone logic if needed
    // private _createRampBoostZone(ramp: Mesh): void { ... }
}
