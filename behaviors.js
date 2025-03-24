/**
 * Behavior classes for the Three.js Game Engine
 * These classes can be used in scripts to add common game behaviors
 */

// Base class for all behaviors
export class Behavior {
    constructor(script) {
        this.script = script;
        this.transform = script.transform;
        this.object = script.object;
        this.engine = script.engine;
        this.enabled = true;
    }
    
    update(deltaTime) {}
    enable() { this.enabled = true; }
    disable() { this.enabled = false; }
}

// Rotation behavior - rotates an object along specified axes
export class Rotator extends Behavior {
    constructor(script, speed = { x: 0, y: 1, z: 0 }) {
        super(script);
        this.speed = speed;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        this.transform.rotation.x += this.speed.x * deltaTime;
        this.transform.rotation.y += this.speed.y * deltaTime;
        this.transform.rotation.z += this.speed.z * deltaTime;
    }
    
    setSpeed(axis, value) {
        this.speed[axis] = value;
    }
}

// Oscillator - makes an object move back and forth along an axis
export class Oscillator extends Behavior {
    constructor(script, axis = 'y', amplitude = 1, frequency = 1) {
        super(script);
        this.axis = axis;
        this.amplitude = amplitude;
        this.frequency = frequency;
        this.startPosition = this.transform.position.clone();
        this.time = 0;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        this.time += deltaTime * this.frequency;
        const offset = Math.sin(this.time) * this.amplitude;
        
        // Reset to start position then apply offset to maintain other position changes
        this.transform.position[this.axis] = this.startPosition[this.axis] + offset;
    }
    
    resetStartPosition() {
        this.startPosition = this.transform.position.clone();
    }
}

// Follower - makes an object follow a target
export class Follower extends Behavior {
    constructor(script, target = null, speed = 2, minDistance = 0.1) {
        super(script);
        this.target = target; // Can be a THREE.Object3D or an engine object
        this.speed = speed;
        this.minDistance = minDistance;
    }
    
    update(deltaTime) {
        if (!this.enabled || !this.target) return;
        
        // Get target position (handle both THREE.Object3D and engine objects)
        const targetPosition = this.target.position || 
                              (this.target.object3D ? this.target.object3D.position : null);
        
        if (!targetPosition) return;
        
        // Calculate direction to target
        const direction = targetPosition.clone().sub(this.transform.position).normalize();
        
        // Calculate distance
        const distance = this.transform.position.distanceTo(targetPosition);
        
        // Only move if far enough
        if (distance > this.minDistance) {
            const movement = direction.multiplyScalar(this.speed * deltaTime);
            this.transform.position.add(movement);
        }
    }
    
    setTarget(target) {
        this.target = target;
    }
}

// LookAt behavior - makes an object look at a target
export class LookAt extends Behavior {
    constructor(script, target = null, smooth = false, smoothFactor = 5) {
        super(script);
        this.target = target;
        this.smooth = smooth;
        this.smoothFactor = smoothFactor;
    }
    
    update(deltaTime) {
        if (!this.enabled || !this.target) return;
        
        // Get target position (handle both THREE.Object3D and engine objects)
        const targetPosition = this.target.position || 
                              (this.target.object3D ? this.target.object3D.position : null);
        
        if (!targetPosition) return;
        
        if (this.smooth) {
            // Create a temporary look direction
            const currentRotation = this.transform.quaternion.clone();
            
            // Create a temporary object to calculate the target rotation
            const tempObj = this.transform.clone();
            tempObj.lookAt(targetPosition);
            
            // Slerp between current and target rotation
            this.transform.quaternion.slerp(tempObj.quaternion, this.smoothFactor * deltaTime);
        } else {
            this.transform.lookAt(targetPosition);
        }
    }
}

// Orbit behavior - makes an object orbit around a target
export class Orbit extends Behavior {
    constructor(script, target = null, speed = 1, radius = 5, heightOffset = 0) {
        super(script);
        this.target = target;
        this.speed = speed;
        this.radius = radius;
        this.heightOffset = heightOffset;
        this.angle = 0;
    }
    
    update(deltaTime) {
        if (!this.enabled || !this.target) return;
        
        // Get target position (handle both THREE.Object3D and engine objects)
        const targetPosition = this.target.position || 
                              (this.target.object3D ? this.target.object3D.position : null);
        
        if (!targetPosition) return;
        
        // Update angle
        this.angle += this.speed * deltaTime;
        
        // Calculate new position
        const x = targetPosition.x + Math.cos(this.angle) * this.radius;
        const z = targetPosition.z + Math.sin(this.angle) * this.radius;
        const y = targetPosition.y + this.heightOffset;
        
        // Update position
        this.transform.position.set(x, y, z);
        
        // Look at the target
        this.transform.lookAt(targetPosition);
    }
}

// Timer - executes a callback after a specified time
export class Timer extends Behavior {
    constructor(script, duration, callback, repeat = false) {
        super(script);
        this.duration = duration;
        this.callback = callback;
        this.repeat = repeat;
        this.time = 0;
        this.complete = false;
    }
    
    update(deltaTime) {
        if (!this.enabled || this.complete) return;
        
        this.time += deltaTime;
        
        if (this.time >= this.duration) {
            this.callback.call(this.script);
            
            if (this.repeat) {
                this.time = 0;
            } else {
                this.complete = true;
            }
        }
    }
    
    reset() {
        this.time = 0;
        this.complete = false;
    }
}

// Physics body - adds simple physics properties and behaviors
export class PhysicsBody extends Behavior {
    constructor(script, options = {}) {
        super(script);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.mass = options.mass || 1;
        this.useGravity = options.useGravity !== undefined ? options.useGravity : true;
        this.gravity = options.gravity || -9.8;
        this.drag = options.drag || 0.1;
        this.bounciness = options.bounciness || 0.5;
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        // Apply gravity
        if (this.useGravity) {
            this.acceleration.y = this.gravity;
        }
        
        // Apply acceleration
        this.velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));
        
        // Apply drag
        this.velocity.multiplyScalar(1 - this.drag * deltaTime);
        
        // Apply velocity
        this.transform.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Simple floor collision
        if (this.transform.position.y < 0) {
            this.transform.position.y = 0;
            this.velocity.y = -this.velocity.y * this.bounciness;
        }
        
        // Reset acceleration
        this.acceleration.set(0, this.useGravity ? this.gravity : 0, 0);
    }
    
    applyForce(force) {
        // F = ma, so a = F/m
        const accelerationChange = force.clone().divideScalar(this.mass);
        this.acceleration.add(accelerationChange);
    }
    
    applyImpulse(impulse) {
        // Immediate change in velocity
        const velocityChange = impulse.clone().divideScalar(this.mass);
        this.velocity.add(velocityChange);
    }
    
    setVelocity(x, y, z) {
        this.velocity.set(x, y, z);
    }
}

// Input controller - handles keyboard input for character movement
export class InputController extends Behavior {
    constructor(script, options = {}) {
        super(script);
        this.moveSpeed = options.moveSpeed || 5;
        this.jumpForce = options.jumpForce || 10;
        this.rotationSpeed = options.rotationSpeed || 2;
        this.moveForward = options.moveForward || 'KeyW';
        this.moveBackward = options.moveBackward || 'KeyS';
        this.moveLeft = options.moveLeft || 'KeyA';
        this.moveRight = options.moveRight || 'KeyD';
        this.jump = options.jump || 'Space';
        this.sprint = options.sprint || 'ShiftLeft';
        this.isGrounded = true;
        
        // Check if we should add a physics body
        if (options.addPhysicsBody) {
            this.physics = new PhysicsBody(script, {
                mass: options.mass || 1,
                useGravity: options.useGravity !== undefined ? options.useGravity : true
            });
        }
    }
    
    update(deltaTime) {
        if (!this.enabled) return;
        
        // Update physics if we have it
        if (this.physics) {
            this.physics.update(deltaTime);
        }
        
        // Calculate movement direction
        let moveX = 0;
        let moveZ = 0;
        
        if (this.script.isKeyPressed(this.moveForward)) moveZ -= 1;
        if (this.script.isKeyPressed(this.moveBackward)) moveZ += 1;
        if (this.script.isKeyPressed(this.moveLeft)) moveX -= 1;
        if (this.script.isKeyPressed(this.moveRight)) moveX += 1;
        
        // Calculate speed (with sprint modifier)
        const speed = this.script.isKeyPressed(this.sprint) ? 
            this.moveSpeed * 2 : this.moveSpeed;
        
        // Normalize movement vector
        if (moveX !== 0 || moveZ !== 0) {
            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            moveX /= length;
            moveZ /= length;
        }
        
        // Apply movement
        if (this.physics) {
            // With physics, we apply forces
            const force = new THREE.Vector3(moveX * speed, 0, moveZ * speed);
            this.physics.applyForce(force);
            
            // Jumping
            if (this.script.isKeyDown(this.jump) && this.isGrounded) {
                this.physics.applyImpulse(new THREE.Vector3(0, this.jumpForce, 0));
                this.isGrounded = false;
            }
            
            // Check if we're on the ground
            if (this.transform.position.y <= 0.001) {
                this.isGrounded = true;
            }
        } else {
            // Without physics, we directly modify position
            this.transform.position.x += moveX * speed * deltaTime;
            this.transform.position.z += moveZ * speed * deltaTime;
            
            // Simple jumping
            if (this.script.isKeyDown(this.jump) && this.isGrounded) {
                this.script.startCoroutine(this.jumpCoroutine());
            }
        }
    }
    
    *jumpCoroutine() {
        this.isGrounded = false;
        const jumpHeight = 2;
        const jumpDuration = 0.5;
        const startY = this.transform.position.y;
        
        // Jump up
        let timer = 0;
        while (timer < jumpDuration / 2) {
            const height = this.easeInOut(timer / (jumpDuration / 2)) * jumpHeight;
            this.transform.position.y = startY + height;
            timer += yield;
        }
        
        // Fall down
        timer = 0;
        while (timer < jumpDuration / 2) {
            const height = (1 - this.easeInOut(timer / (jumpDuration / 2))) * jumpHeight;
            this.transform.position.y = startY + height;
            timer += yield;
        }
        
        // Ensure we're back at the start height
        this.transform.position.y = startY;
        this.isGrounded = true;
    }
    
    easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
}

// Camera controller - follows a target with various options
export class CameraController extends Behavior {
    constructor(script, target = null, options = {}) {
        super(script);
        this.target = target;
        this.offset = options.offset || new THREE.Vector3(0, 5, 10);
        this.lookOffset = options.lookOffset || new THREE.Vector3(0, 0, 0);
        this.smoothing = options.smoothing !== undefined ? options.smoothing : 5;
        this.rotationSmoothing = options.rotationSmoothing !== undefined ? options.rotationSmoothing : 5;
        this.type = options.type || 'follow'; // 'follow', 'lookAt', 'firstPerson', 'orbit'
        this.orbitAngle = 0;
        this.orbitSpeed = options.orbitSpeed || 1;
        this.orbitRadius = options.orbitRadius || 10;
        this.orbitHeight = options.orbitHeight || 5;
    }
    
    update(deltaTime) {
        if (!this.enabled || !this.target) return;
        
        // Get target position (handle both THREE.Object3D and engine objects)
        const targetPosition = this.target.position || 
                              (this.target.object3D ? this.target.object3D.position : null);
        
        if (!targetPosition) return;
        
        // Different camera behaviors
        switch (this.type) {
            case 'follow':
                this.followTarget(targetPosition, deltaTime);
                break;
            case 'lookAt':
                this.lookAtTarget(targetPosition);
                break;
            case 'firstPerson':
                this.firstPersonView(targetPosition);
                break;
            case 'orbit':
                this.orbitTarget(targetPosition, deltaTime);
                break;
        }
    }
    
    followTarget(targetPosition, deltaTime) {
        // Calculate desired position
        const desiredPosition = targetPosition.clone().add(this.offset);
        
        // Smooth movement
        if (this.smoothing > 0) {
            this.transform.position.lerp(desiredPosition, this.smoothing * deltaTime);
        } else {
            this.transform.position.copy(desiredPosition);
        }
        
        // Look at target plus offset
        const lookTarget = targetPosition.clone().add(this.lookOffset);
        
        if (this.rotationSmoothing > 0) {
            // Create a temporary look direction
            const tempObj = this.transform.clone();
            tempObj.lookAt(lookTarget);
            
            // Slerp between current and target rotation
            this.transform.quaternion.slerp(tempObj.quaternion, this.rotationSmoothing * deltaTime);
        } else {
            this.transform.lookAt(lookTarget);
        }
    }
    
    lookAtTarget(targetPosition) {
        // Just look at the target, don't move
        this.transform.lookAt(targetPosition.clone().add(this.lookOffset));
    }
    
    firstPersonView(targetPosition) {
        // Position camera at target position with offset (usually just a height offset)
        this.transform.position.copy(targetPosition.clone().add(this.offset));
        
        // Rotation should be handled by the target's rotation
        if (this.target.object3D && this.target.object3D.quaternion) {
            this.transform.quaternion.copy(this.target.object3D.quaternion);
        }
    }
    
    orbitTarget(targetPosition, deltaTime) {
        // Update orbit angle
        this.orbitAngle += this.orbitSpeed * deltaTime;
        
        // Calculate position on the orbit circle
        const x = targetPosition.x + Math.cos(this.orbitAngle) * this.orbitRadius;
        const z = targetPosition.z + Math.sin(this.orbitAngle) * this.orbitRadius;
        const y = targetPosition.y + this.orbitHeight;
        
        // Update position
        this.transform.position.set(x, y, z);
        
        // Look at target
        this.transform.lookAt(targetPosition.clone().add(this.lookOffset));
    }
    
    setTarget(target) {
        this.target = target;
    }
    
    setOffset(x, y, z) {
        this.offset.set(x, y, z);
    }
    
    setCameraType(type) {
        this.type = type;
    }
}

// Waypoint follower - makes an object follow a path of waypoints
export class WaypointFollower extends Behavior {
    constructor(script, waypoints = [], options = {}) {
        super(script);
        this.waypoints = waypoints;
        this.speed = options.speed || 2;
        this.waypointRadius = options.waypointRadius || 0.5;
        this.loop = options.loop !== undefined ? options.loop : true;
        this.currentWaypoint = 0;
        this.direction = 1; // 1 = forward, -1 = backward
    }
    
    update(deltaTime) {
        if (!this.enabled || this.waypoints.length === 0) return;
        
        // Get current waypoint
        const waypoint = this.waypoints[this.currentWaypoint];
        
        // Calculate direction to waypoint
        const direction = waypoint.clone().sub(this.transform.position).normalize();
        
        // Calculate distance to waypoint
        const distance = this.transform.position.distanceTo(waypoint);
        
        // Move toward waypoint
        if (distance > this.waypointRadius) {
            const movement = direction.multiplyScalar(this.speed * deltaTime);
            this.transform.position.add(movement);
            
            // Optional: look in the direction of movement
            this.transform.lookAt(waypoint);
        } else {
            // Reached waypoint, move to next
            this.nextWaypoint();
        }
    }
    
    nextWaypoint() {
        if (this.direction === 1) {
            this.currentWaypoint++;
            
            // Reached end of path
            if (this.currentWaypoint >= this.waypoints.length) {
                if (this.loop) {
                    // Loop back to start
                    this.currentWaypoint = 0;
                } else {
                    // Reached end, go backward
                    this.currentWaypoint = this.waypoints.length - 2;
                    this.direction = -1;
                }
            }
        } else {
            this.currentWaypoint--;
            
            // Reached start of path
            if (this.currentWaypoint < 0) {
                if (this.loop) {
                    // Loop back to end
                    this.currentWaypoint = this.waypoints.length - 1;
                } else {
                    // Reached start, go forward
                    this.currentWaypoint = 1;
                    this.direction = 1;
                }
            }
        }
    }
    
    addWaypoint(position) {
        this.waypoints.push(position.clone());
    }
    
    clearWaypoints() {
        this.waypoints = [];
        this.currentWaypoint = 0;
    }
}

// Animation controller - manages and blends animations
export class AnimationController extends Behavior {
    constructor(script, options = {}) {
        super(script);
        this.mixer = null;
        this.clips = {};
        this.actions = {};
        this.currentAction = null;
        this.crossFadeDuration = options.crossFadeDuration || 0.3;
        
        // Initialize if object has animations
        this.initialize();
    }
    
    initialize() {
        // Find the animated model (either this object or a child)
        let model = this.object.object3D;
        
        // Check if this object has animations
        if (model.animations && model.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            
            // Store all animation clips
            for (const clip of model.animations) {
                this.clips[clip.name] = clip;
                this.actions[clip.name] = this.mixer.clipAction(clip);
            }
            
            console.log(`Animation controller initialized with ${Object.keys(this.clips).length} clips`);
        } else {
            console.warn("No animations found on this object");
        }
    }
    
    update(deltaTime) {
        if (!this.enabled || !this.mixer) return;
        
        // Update the animation mixer
        this.mixer.update(deltaTime);
    }
    
    play(clipName, options = {}) {
        if (!this.mixer || !this.actions[clipName]) return;
        
        const action = this.actions[clipName];
        
        // Apply options
        if (options.loop !== undefined) {
            action.loop = options.loop ? THREE.LoopRepeat : THREE.LoopOnce;
        }
        
        if (options.clampWhenFinished !== undefined) {
            action.clampWhenFinished = options.clampWhenFinished;
        }
        
        if (options.timeScale !== undefined) {
            action.timeScale = options.timeScale;
        }
        
        // Transition from current animation
        if (this.currentAction && this.currentAction !== action) {
            const crossFadeDuration = options.crossFadeDuration || this.crossFadeDuration;
            this.currentAction.crossFadeTo(action, crossFadeDuration, true);
        }
        
        // Play the animation
        action.play();
        this.currentAction = action;
        
        return action;
    }
    
    stop(clipName) {
        if (!this.mixer || !clipName) {
            // Stop all animations
            if (this.currentAction) {
                this.currentAction.stop();
                this.currentAction = null;
            }
        } else if (this.actions[clipName]) {
            // Stop specific animation
            this.actions[clipName].stop();
            if (this.currentAction === this.actions[clipName]) {
                this.currentAction = null;
            }
        }
    }
    
    getAction(clipName) {
        return this.actions[clipName];
    }
    
    setTimeScale(timeScale) {
        if (this.mixer) {
            this.mixer.timeScale = timeScale;
        }
    }
}

// State machine - manages object states and transitions
export class StateMachine extends Behavior {
    constructor(script) {
        super(script);
        this.states = {};
        this.currentState = null;
        this.previousState = null;
        this.stateStack = [];
        this.globalTransitions = [];
    }
    
    addState(name, callbacks) {
        this.states[name] = {
            name,
            onEnter: callbacks.onEnter || (() => {}),
            onUpdate: callbacks.onUpdate || (() => {}),
            onExit: callbacks.onExit || (() => {})
        };
        
        // Set as current if it's the first state
        if (!this.currentState) {
            this.currentState = this.states[name];
            if (this.currentState.onEnter) {
                this.currentState.onEnter.call(this.script);
            }
        }
        
        return this;
    }
    
    update(deltaTime) {
        if (!this.enabled || !this.currentState) return;
        
        // Check global transitions
        if (this.globalTransitions) {
            for (const trans of this.globalTransitions) {
                if (this.currentState === trans.fromState && trans.condition()) {
                    this.transition(trans.toState);
                    break;
                }
            }
        }
        
        // Call current state's update method
        if (this.currentState.onUpdate) {
            this.currentState.onUpdate.call(this.script, deltaTime);
        }
    }
    
    transition(stateName) {
        if (!this.states[stateName] || this.states[stateName] === this.currentState) return;
        
        // Exit current state
        if (this.currentState && this.currentState.onExit) {
            this.currentState.onExit.call(this.script);
        }
        
        // Store previous state
        this.previousState = this.currentState;
        
        // Enter new state
        this.currentState = this.states[stateName];
        if (this.currentState.onEnter) {
            this.currentState.onEnter.call(this.script);
        }
    }
    
    pushState(stateName) {
        if (this.currentState === stateName) return;
        this.stateStack.push(stateName);
        this.transition(stateName);
    }
    
    popState() {
        if (this.stateStack.length > 1) {
            this.stateStack.pop();
            this.transition(this.stateStack[this.stateStack.length-1]);
        }
    }
    
    addGlobalTransition(fromState, toState, condition) {
        this.globalTransitions = this.globalTransitions || [];
        this.globalTransitions.push({ fromState, toState, condition });
    }
    
    getCurrentState() {
        return this.currentState ? this.currentState.name : null;
    }
    
    getPreviousState() {
        return this.previousState ? this.previousState.name : null;
    }
    
    isInState(stateName) {
        return this.currentState && this.currentState.name === stateName;
    }
}