import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { HingeConstraint } from "@babylonjs/core/Physics/v2/physicsConstraint";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"; // Added for material access

// Side effect imports to enable features
import "@babylonjs/core/Physics/physicsEngineComponent";
import "@babylonjs/loaders/glTF"; // Needed for GLB loading
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { CharacterSupportedState, PhysicsCharacterController } from "@babylonjs/core/Physics/v2/characterController";
import { PBRMaterial } from "@babylonjs/core";

// Define an interface for the Havok instance (adjust path if necessary)
interface HavokInstance {
  // Define methods/properties expected from HavokPhysics() result if needed
  // For now, an empty interface or 'any' might suffice if direct interaction isn't complex
}

export default class PlayerControllerScene {
  private camera: FreeCamera; // Changed from ArcRotateCamera

  constructor(private scene: Scene, private canvas: HTMLCanvasElement, private engine: Engine | WebGPUEngine) {
    this._createPlayerControllerScene();
  }

  async _createPlayerControllerScene(): Promise<void> {
    // This creates and positions a free camera (non-mesh)
    // Use this.camera instead of declaring a new var
    this.camera = new FreeCamera("camera1", new Vector3(0, 5, -5), this.scene);
    // Note: camera.attachControl is not used here as in the original snippet for ArcRotateCamera
    // The new logic handles camera movement via pointer events on the scene.

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    // Load GLB exported from Blender using Physics extension enabled
    SceneLoader.ImportMeshAsync("", "https://raw.githubusercontent.com/CedricGuillemet/dump/master/CharController/", "levelTest.glb", this.scene).then(() => {
      // Load a texture that will be used as lightmap. This Lightmap was made using this process : https://www.youtube.com/watch?v=Q4Ajd06eTak
      var lightmap = new Texture("https://raw.githubusercontent.com/CedricGuillemet/dump/master/CharController/lightmap.jpg", this.scene);
      // Meshes using the lightmap
      var lightmapped = ["level_primitive0", "level_primitive1", "level_primitive2"];
      lightmapped.forEach((meshName) => {
        var mesh = this.scene.getMeshByName(meshName);
        if (mesh && mesh.material) { // Check if mesh and material exist
          // Create static physics shape for these particular meshes
          new PhysicsAggregate(mesh, PhysicsShapeType.MESH, { mass: 0 }, this.scene); // Specify mass 0 for static
           mesh.isPickable = false;  
          if (mesh.material instanceof PBRMaterial || mesh.material instanceof StandardMaterial) {
          mesh.material.lightmapTexture = lightmap;
          mesh.material.useLightmapAsShadowmap = true;
          // Ensure lightmapTexture is not null before accessing properties
          if (mesh.material.lightmapTexture) {
            // @ts-ignore
            mesh.material.lightmapTexture.uAng = Math.PI; // uAng does not exist on BaseTexture in v8+
            mesh.material.lightmapTexture.level = 1.6;
            mesh.material.lightmapTexture.coordinatesIndex = 1;
          }
        }
          mesh.freezeWorldMatrix();
          mesh.doNotSyncBoundingInfo = true;
        }
      });
      // static physics cubes
      var cubes = ["Cube", "Cube.001", "Cube.002", "Cube.003", "Cube.004", "Cube.005"];
      cubes.forEach((meshName) => {
        const mesh = this.scene.getMeshByName(meshName);
        if (mesh) { // Check if mesh exists
          new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0.1 }, this.scene);
        }
      });
      // inclined plane
      var planeMesh = this.scene.getMeshByName("Cube.006");
      var fixedMassMesh = this.scene.getMeshByName("Cube.007"); // Renamed for clarity

      if (planeMesh && fixedMassMesh) { // Check if meshes exist
        planeMesh.scaling.set(0.03, 3, 1);
        var fixedMass = new PhysicsAggregate(fixedMassMesh, PhysicsShapeType.BOX, { mass: 0 }, this.scene); // mass 0
        var plane = new PhysicsAggregate(planeMesh, PhysicsShapeType.BOX, { mass: 0.1 }, this.scene);

        // plane joint
        var joint = new HingeConstraint(
          new Vector3(0.75, 0, 0),
          new Vector3(-0.25, 0, 0),
          new Vector3(0, 0, -1),
          new Vector3(0, 0, 1),
          this.scene);
        fixedMass.body.addConstraint(plane.body, joint);
      }

      // Player/Character state
      var state = "IN_AIR";
      var inAirSpeed = 8.0;
      var onGroundSpeed = 10.0;
      var jumpHeight = 1.5;
      var wantJump = false;
      var inputDirection = new Vector3(0, 0, 0);
      var forwardLocalSpace = new Vector3(0, 0, 1);
      let characterOrientation = Quaternion.Identity();
      let characterGravity = new Vector3(0, -18, 0); // Increased gravity

      // Physics shape for the character
      let h = 1.8;
      let r = 0.6;
      let displayCapsule = MeshBuilder.CreateCapsule("CharacterDisplay", { height: h, radius: r }, this.scene);
      // Increase initial Y position to ensure starting above ground
      let characterPosition = new Vector3(3., 2.0, -8.); // Changed Y from 0.3 to 1.0
      // Correct constructor based on original snippet: position, options, scene
      let characterController = new PhysicsCharacterController(characterPosition, {
        capsuleHeight: h,
        capsuleRadius: r,
      }, this.scene); // Added this.scene back as the third argument
      // The displayCapsule mesh will be updated based on characterController.getPosition() later

      this.camera.setTarget(characterPosition); // Initial camera target

        // State handling
        // depending on character state and support, set the new state
        var getNextState = function(supportInfo) {
            if (state == "IN_AIR") {
                if (supportInfo.supportedState == CharacterSupportedState.SUPPORTED) {
                    return "ON_GROUND";
                }
                return "IN_AIR";
            } else if (state == "ON_GROUND") {
                if (supportInfo.supportedState != CharacterSupportedState.SUPPORTED) {
                    return "IN_AIR";
                }

                if (wantJump) {
                    return "START_JUMP";
                }
                return "ON_GROUND";
            } else if (state == "START_JUMP") {
                return "IN_AIR";
            }
            return state;
        }

      // From aiming direction and state, compute a desired velocity
      // That velocity depends on current state (in air, on ground, jumping, ...) and surface properties
      // --- replace your entire getDesiredVelocity() with this ---
    var getDesiredVelocity = function(deltaTime, supportInfo, characterOrientation, currentVelocity) {
            let nextState = getNextState(supportInfo);
            if (nextState != state) {
                state = nextState;
            }

            let upWorld = characterGravity.normalizeToNew();
            upWorld.scaleInPlace(-1.0);
            let forwardWorld = forwardLocalSpace.applyRotationQuaternion(characterOrientation);
            if (state == "IN_AIR") {
                let desiredVelocity = inputDirection.scale(inAirSpeed).applyRotationQuaternion(characterOrientation);
                let outputVelocity = characterController.calculateMovement(deltaTime, forwardWorld, upWorld, currentVelocity, Vector3.ZeroReadOnly, desiredVelocity, upWorld);
                // Restore to original vertical component
                outputVelocity.addInPlace(upWorld.scale(-outputVelocity.dot(upWorld)));
                outputVelocity.addInPlace(upWorld.scale(currentVelocity.dot(upWorld)));
                // Add gravity
                outputVelocity.addInPlace(characterGravity.scale(deltaTime));
                return outputVelocity;
            } else if (state == "ON_GROUND") {
                // Move character relative to the surface we're standing on
                // Correct input velocity to apply instantly any changes in the velocity of the standing surface and this way
                // avoid artifacts caused by filtering of the output velocity when standing on moving objects.
                let desiredVelocity = inputDirection.scale(onGroundSpeed).applyRotationQuaternion(characterOrientation);

                let outputVelocity = characterController.calculateMovement(deltaTime, forwardWorld, supportInfo.averageSurfaceNormal, currentVelocity, supportInfo.averageSurfaceVelocity, desiredVelocity, upWorld);
                // Horizontal projection
                {
                    outputVelocity.subtractInPlace(supportInfo.averageSurfaceVelocity);
                    let inv1k = 1e-3;
                    if (outputVelocity.dot(upWorld) > inv1k) {
                        let velLen = outputVelocity.length();
                        outputVelocity.normalizeFromLength(velLen);

                        // Get the desired length in the horizontal direction
                        let horizLen = velLen / supportInfo.averageSurfaceNormal.dot(upWorld);

                        // Re project the velocity onto the horizontal plane
                        let c = supportInfo.averageSurfaceNormal.cross(outputVelocity);
                        outputVelocity = c.cross(upWorld);
                        outputVelocity.scaleInPlace(horizLen);
                    }
                    outputVelocity.addInPlace(supportInfo.averageSurfaceVelocity);
                    return outputVelocity;
                }
            } else if (state == "START_JUMP") {
                let u = Math.sqrt(2 * characterGravity.length() * jumpHeight);
                let curRelVel = currentVelocity.dot(upWorld);
                return currentVelocity.add(upWorld.scale(u - curRelVel));
            }
            return Vector3.Zero();
        }


          // Display tick update: compute new camera position/target, update the capsule for the character display
        this.scene.onBeforeRenderObservable.add((scene) => {
            displayCapsule.position.copyFrom(characterController.getPosition());

            // camera following
            var cameraDirection = this.camera.getDirection(new Vector3(0,0,1));
            cameraDirection.y = 0;
            cameraDirection.normalize();
            this.camera.setTarget(Vector3.Lerp(this.camera.getTarget(), displayCapsule.position, 0.1));
            var dist = Vector3.Distance(this.camera.position, displayCapsule.position);
            const amount = (Math.min(dist - 6, 0) + Math.max(dist - 9, 0)) * 0.04;
            cameraDirection.scaleAndAddToRef(amount, this.camera.position);
            this.camera.position.y += (displayCapsule.position.y + 2 - this.camera.position.y) * 0.04;
        });

        // After physics update, compute and set new velocity, update the character controller state
        this.scene.onAfterPhysicsObservable.add((_) => {
            if (this.scene.deltaTime == undefined) return;
            let dt = this.scene.deltaTime / 1000.0;
            if (dt == 0) return;

            let down = new Vector3(0, -1, 0);
            let support = characterController.checkSupport(dt, down);

           Quaternion.FromEulerAnglesToRef(0,this.camera.rotation.y, 0, characterOrientation);
            let desiredLinearVelocity = getDesiredVelocity(dt, support, characterOrientation, characterController.getVelocity());
            characterController.setVelocity(desiredLinearVelocity);

            characterController.integrate(dt, support, characterGravity);
        });


      // Rotate camera
// Rotate camera
        // Add a slide vector to rotate arount the character
        let isMouseDown = false;
        this.scene.onPointerObservable.add((pointerInfo) => {
            switch (pointerInfo.type) {
                case PointerEventTypes.POINTERDOWN:
                    isMouseDown = true;
                    break;

                case PointerEventTypes.POINTERUP:
                    isMouseDown = false;
                    break;
                case  PointerEventTypes.POINTERMOVE:
                    if (isMouseDown) {
                        var tgt = this.camera.getTarget().clone();
                        this.camera.position.addInPlace(this.camera.getDirection(Vector3.Right()).scale(pointerInfo.event.movementX * -0.02));
                        this.camera.setTarget(tgt);
                    }
                    break;
            }
        });
      // Input to direction
      // from keys down/up, update the Vector3 inputDirection to match the intended direction. Jump with space
        this.scene.onKeyboardObservable.add((kbInfo) => {
            switch (kbInfo.type) {
                case KeyboardEventTypes.KEYDOWN:
                    if (kbInfo.event.key == 'w' || kbInfo.event.key == 'ArrowUp') {
                        inputDirection.z = 1;
                    } else if (kbInfo.event.key == 's' || kbInfo.event.key == 'ArrowDown') {
                        inputDirection.z = -1;
                    } else if (kbInfo.event.key == 'a' || kbInfo.event.key == 'ArrowLeft') {
                        inputDirection.x = -1;
                    } else if (kbInfo.event.key == 'd' || kbInfo.event.key == 'ArrowRight') {
                        inputDirection.x = 1;
                    } else if (kbInfo.event.key == ' ') {
                        wantJump = true;
                    }
                    break;
                case KeyboardEventTypes.KEYUP:
                    if (kbInfo.event.key == 'w' || kbInfo.event.key == 's' || kbInfo.event.key == 'ArrowUp' || kbInfo.event.key == 'ArrowDown') {
                        inputDirection.z = 0;    
                    }
                    if (kbInfo.event.key == 'a' || kbInfo.event.key == 'd' || kbInfo.event.key == 'ArrowLeft' || kbInfo.event.key == 'ArrowRight') {
                        inputDirection.x = 0;
                    } else if (kbInfo.event.key == ' ') {
                        wantJump = false;
                    }
                    break;
            }
        });
    });
  }
}
