import * as THREE from 'three';
import * as Behaviors from './behaviors.js';

// Add Tween and GameLoop classes for animation and game logic
class Tween {
    constructor(target, properties, duration, easing = 'linear', onComplete = null) {
        this.target = target;
        this.startProps = {};
        this.endProps = properties;
        this.duration = duration;
        this.easing = easing;
        this.onComplete = onComplete;
        this.time = 0;
        this.isActive = true;
        this.isCompleted = false;
        
        // Store starting values
        for (const key in this.endProps) {
            if (target[key] !== undefined) {
                this.startProps[key] = target[key];
            }
        }
    }
    
    update(deltaTime) {
        if (!this.isActive || this.isCompleted) return;
        
        this.time += deltaTime;
        const t = Math.min(this.time / this.duration, 1);
        const easedT = this.getEasedT(t);
        
        // Apply interpolated values
        for (const key in this.endProps) {
            if (this.startProps[key] !== undefined) {
                this.target[key] = this.startProps[key] + (this.endProps[key] - this.startProps[key]) * easedT;
            }
        }
        
        // Check if completed
        if (t >= 1) {
            this.isCompleted = true;
            if (this.onComplete) this.onComplete();
        }
    }
    
    getEasedT(t) {
        switch (this.easing) {
            case 'linear': return t;
            case 'easeIn': return t * t;
            case 'easeOut': return t * (2 - t);
            case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            case 'elastic': return (t === 0 || t === 1) ? t : 
                -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
            case 'bounce': {
                if (t < (1/2.75)) {
                    return 7.5625 * t * t;
                } else if (t < (2/2.75)) {
                    return 7.5625 * (t -= (1.5/2.75)) * t + 0.75;
                } else if (t < (2.5/2.75)) {
                    return 7.5625 * (t -= (2.25/2.75)) * t + 0.9375;
                } else {
                    return 7.5625 * (t -= (2.625/2.75)) * t + 0.984375;
                }
            }
            default: return t;
        }
    }
    
    stop() {
        this.isActive = false;
    }
    
    resume() {
        this.isActive = true;
    }
    
    reset() {
        this.time = 0;
        this.isCompleted = false;
    }
}

class GameLoop {
    constructor() {
        this.fixedTimeStep = 1/60; // 60 updates per second
        this.maxSubSteps = 5; // Prevent spiral of death
        this.accumulator = 0;
        this.callbacks = {
            update: [],
            fixedUpdate: [],
            lateUpdate: []
        };
    }
    
    addCallback(type, callback, context = null) {
        if (this.callbacks[type]) {
            this.callbacks[type].push({ callback, context });
            return true;
        }
        return false;
    }
    
    removeCallback(type, callback, context = null) {
        if (this.callbacks[type]) {
            this.callbacks[type] = this.callbacks[type].filter(item => 
                item.callback !== callback || item.context !== context
            );
            return true;
        }
        return false;
    }
    
    update(deltaTime) {
        // Run update callbacks (variable timestep)
        this.runCallbacks('update', deltaTime);
        
        // Accumulate time for fixed timestep
        this.accumulator += deltaTime;
        
        // Run fixed update with fixed timestep
        let subSteps = 0;
        while (this.accumulator >= this.fixedTimeStep && subSteps < this.maxSubSteps) {
            this.runCallbacks('fixedUpdate', this.fixedTimeStep);
            this.accumulator -= this.fixedTimeStep;
            subSteps++;
        }
        
        // Run late update callbacks
        this.runCallbacks('lateUpdate', deltaTime);
    }
    
    runCallbacks(type, deltaTime) {
        for (const item of this.callbacks[type]) {
            try {
                item.callback.call(item.context, deltaTime);
            } catch (e) {
                console.error(`Error in GameLoop ${type} callback:`, e);
            }
        }
    }
    
    setFixedTimeStep(timeStep) {
        this.fixedTimeStep = timeStep;
    }
    
    clear() {
        this.callbacks.update = [];
        this.callbacks.fixedUpdate = [];
        this.callbacks.lateUpdate = [];
    }
}

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            size: 0
        };
        this.maxSize = 1000; // Default max size
        this.expiryTimes = new Map();
    }
    
    set(key, value, expirySeconds = null) {
        // If cache is full, remove oldest items
        if (this.cache.size >= this.maxSize) {
            this.pruneCache();
        }
        
        // Store the value
        this.cache.set(key, value);
        this.stats.size = this.cache.size;
        
        // Set expiry time if provided
        if (expirySeconds !== null) {
            const expiryTime = Date.now() + (expirySeconds * 1000);
            this.expiryTimes.set(key, expiryTime);
        }
        
        return true;
    }
    
    get(key) {
        this.removeExpired();
        
        if (this.cache.has(key)) {
            this.stats.hits++;
            return this.cache.get(key);
        }
        
        this.stats.misses++;
        return null;
    }
    
    has(key) {
        this.removeExpired();
        return this.cache.has(key);
    }
    
    remove(key) {
        const result = this.cache.delete(key);
        this.expiryTimes.delete(key);
        this.stats.size = this.cache.size;
        return result;
    }
    
    clear() {
        this.cache.clear();
        this.expiryTimes.clear();
        this.stats.size = 0;
        return true;
    }
    
    removeExpired() {
        const now = Date.now();
        
        for (const [key, expiryTime] of this.expiryTimes.entries()) {
            if (expiryTime <= now) {
                this.cache.delete(key);
                this.expiryTimes.delete(key);
            }
        }
        
        this.stats.size = this.cache.size;
    }
    
    pruneCache() {
        // Simple strategy: remove oldest 10% of items
        const removeCount = Math.ceil(this.maxSize * 0.1);
        let i = 0;
        
        for (const key of this.cache.keys()) {
            if (i >= removeCount) break;
            this.cache.delete(key);
            this.expiryTimes.delete(key);
            i++;
        }
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    setMaxSize(size) {
        this.maxSize = size;
        if (this.cache.size > this.maxSize) {
            this.pruneCache();
        }
    }
}

// Add Timer class for scheduling callbacks
class Timer {
    constructor(callback, delay, repeat = false) {
        this.callback = callback;
        this.delay = delay;
        this.repeat = repeat;
        this.elapsed = 0;
        this.isActive = true;
        this.isCompleted = false;
    }
    
    update(deltaTime) {
        if (!this.isActive || this.isCompleted) return;
        
        this.elapsed += deltaTime;
        
        if (this.elapsed >= this.delay) {
            this.callback();
            
            if (this.repeat) {
                this.elapsed = 0;
            } else {
                this.isCompleted = true;
            }
        }
    }
    
    reset() {
        this.elapsed = 0;
        this.isCompleted = false;
    }
    
    stop() {
        this.isActive = false;
    }
    
    resume() {
        this.isActive = true;
    }
}

/**
 * ScriptingSystem manages runtime scripts and behaviors for game objects
 * Handles script creation, initialization, execution, and cleanup
 */
export class ScriptingSystem {
    /**
     * Creates a new ScriptingSystem instance
     * @param {GameEngine} engine - Reference to the main game engine
     */
    constructor(engine) {
        this.engine = engine;
        this.scriptInstances = new Map();
        
        // Tag system for component queries with weak references to avoid memory leaks
        this.objectsByTag = new Map();
        this.objectsByScript = new Map();
        this.weakRefs = new WeakMap(); // Store weak references to objects
        
        // Add game loop manager
        this.gameLoop = new GameLoop();
        
        // Add cache manager
        this.cache = new CacheManager();
        
        // Add tweens management
        this.tweens = [];
        
        // Add timers management
        this.timers = [];
        
        // Track deleted objects to clean up references
        this._pendingCleanup = new Set();
    }
    
    /**
     * Gets all objects with a specified tag
     * @param {string} tag - The tag to search for
     * @returns {Array} - Array of objects with the specified tag
     */
    getObjectsByTag(tag) {
        // Clean up any pending objects first
        this._cleanupDeletedObjects();
        return this.objectsByTag.get(tag) || [];
    }
    
    /**
     * Gets all objects with a specified script
     * @param {string} scriptName - The script name to search for
     * @returns {Array} - Array of objects with the specified script
     */
    getObjectsByScript(scriptName) {
        // Clean up any pending objects first
        this._cleanupDeletedObjects();
        return this.objectsByScript.get(scriptName) || [];
    }
    
    /**
     * Adds a tag to an object
     * @param {Object} obj - The object to tag
     * @param {string} tag - The tag to add
     */
    addTag(obj, tag) {
        if (!obj.tags) {
            obj.tags = new Set();
        }
        
        obj.tags.add(tag);
        
        // Update tag index
        if (!this.objectsByTag.has(tag)) {
            this.objectsByTag.set(tag, []);
        }
        
        const taggedObjects = this.objectsByTag.get(tag);
        if (!taggedObjects.includes(obj)) {
            taggedObjects.push(obj);
            
            // Store a weak reference to track object deletion
            if (!this.weakRefs.has(obj)) {
                this.weakRefs.set(obj, new WeakRef(obj));
            }
        }
    }
    
    removeTag(obj, tag) {
        if (!obj.tags || !obj.tags.has(tag)) return;
        
        obj.tags.delete(tag);
        
        // Update tag index
        if (this.objectsByTag.has(tag)) {
            const taggedObjects = this.objectsByTag.get(tag);
            const index = taggedObjects.indexOf(obj);
            if (index !== -1) {
                taggedObjects.splice(index, 1);
            }
            
            if (taggedObjects.length === 0) {
                this.objectsByTag.delete(tag);
            }
        }
    }
    
    markForCleanup(obj) {
        if (obj) {
            this._pendingCleanup.add(obj.id);
        }
    }
    
    _cleanupDeletedObjects() {
        // Process pending explicit cleanups
        if (this._pendingCleanup.size > 0) {
            for (const objId of this._pendingCleanup) {
                this._removeObjectReferences(objId);
            }
            this._pendingCleanup.clear();
        }
        
        // Additionally check weak references
        // Iterate all tag collections
        for (const [tag, objects] of this.objectsByTag.entries()) {
            const validObjects = [];
            for (let i = 0; i < objects.length; i++) {
                const obj = objects[i];
                // Check if the weak reference is still valid
                if (this.weakRefs.has(obj) && this.weakRefs.get(obj).deref()) {
                    validObjects.push(obj);
                }
            }
            
            // Update the collection or remove it if empty
            if (validObjects.length === 0) {
                this.objectsByTag.delete(tag);
            } else if (validObjects.length !== objects.length) {
                this.objectsByTag.set(tag, validObjects);
            }
        }
        
        // Do the same for script collections
        for (const [script, objects] of this.objectsByScript.entries()) {
            const validObjects = [];
            for (let i = 0; i < objects.length; i++) {
                const obj = objects[i];
                if (this.weakRefs.has(obj) && this.weakRefs.get(obj).deref()) {
                    validObjects.push(obj);
                }
            }
            
            if (validObjects.length === 0) {
                this.objectsByScript.delete(script);
            } else if (validObjects.length !== objects.length) {
                this.objectsByScript.set(script, validObjects);
            }
        }
    }
    
    _removeObjectReferences(objId) {
        // Find the object by ID
        const obj = this.engine.getObjectById(objId);
        
        // If object is gone, remove all references by scanning
        this.objectsByTag.forEach((objects, tag) => {
            const updated = objects.filter(o => o.id !== objId);
            if (updated.length === 0) {
                this.objectsByTag.delete(tag);
            } else if (updated.length !== objects.length) {
                this.objectsByTag.set(tag, updated);
            }
        });
        
        this.objectsByScript.forEach((objects, script) => {
            const updated = objects.filter(o => o.id !== objId);
            if (updated.length === 0) {
                this.objectsByScript.delete(script);
            } else if (updated.length !== objects.length) {
                this.objectsByScript.set(script, updated);
            }
        });
        
        // Clean up script instance if it exists
        if (this.scriptInstances.has(objId)) {
            this.scriptInstances.delete(objId);
        }
    }

    serializeAllScriptProperties() {
        const serializedData = {};
        
        this.engine.objects.forEach(obj => {
            if (obj.scriptProperties || (obj.scriptInstance && obj.scriptInstance._properties)) {
                // Get the most up-to-date properties
                const props = obj.scriptInstance ? 
                    obj.scriptInstance._properties : obj.scriptProperties;
                
                if (props && Object.keys(props).length > 0) {
                    serializedData[obj.id] = {
                        properties: {...props},
                        scriptName: obj.scriptInstance ? obj.scriptInstance.scriptName : "Unknown"
                    };
                }
            }
        });
        
        return serializedData;
    }
    
    deserializeAllScriptProperties(data) {
        if (!data) return;
        
        Object.entries(data).forEach(([objId, scriptData]) => {
            const obj = this.engine.getObjectById(objId);
            if (obj) {
                // Store properties to be applied when script is initialized
                obj.scriptProperties = scriptData.properties;
                
                // If script is already running, update it immediately
                if (obj.scriptInstance) {
                    Object.assign(obj.scriptInstance._properties, scriptData.properties);
                }
            }
        });
    }

    createTween(target, properties, duration, easing = 'linear', onComplete = null) {
        const tween = new Tween(target, properties, duration, easing, onComplete);
        this.tweens.push(tween);
        return tween;
    }
    
    /**
     * Updates all active tweens
     * @param {number} deltaTime - Time since last frame in seconds
     */
    updateTweens(deltaTime) {
        // Update all tweens
        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const tween = this.tweens[i];
            tween.update(deltaTime);
            
            // Remove completed tweens
            if (tween.isCompleted) {
                this.tweens.splice(i, 1);
            }
        }
    }

    /**
     * Updates all active timers
     * @param {number} deltaTime - Time since last frame in seconds
     */
    updateTimers(deltaTime) {
        // Update all timers
        for (let i = this.timers.length - 1; i >= 0; i--) {
            const timer = this.timers[i];
            timer.update(deltaTime);
            
            // Remove completed non-repeating timers
            if (timer.isCompleted && !timer.repeat) {
                this.timers.splice(i, 1);
            }
        }
    }

    createScriptInstance(obj) {
        if (!obj.script) return null;
        
        try {
            // Extract script name from the first line comment if available
            let extractedScriptName = "UnnamedScript";
            const firstLineMatch = obj.script.match(/^\/\/\s*(.+?)\s*$/m);
            if (firstLineMatch) {
                extractedScriptName = firstLineMatch[1].trim();
            }
            
            const enhancedScript = `
                // Add state machine support
                const stateMachine = new this.Containers.StateMachine();
                
                // Add debug utilities
                const Debug = {
                    drawLine: (start, end, color = 0xff0000, duration = 1) => {
                        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
                        const material = new THREE.LineBasicMaterial({ color });
                        const line = new THREE.Line(geometry, material);
                        this.scene.add(line);
                        setTimeout(() => this.scene.remove(line), duration * 1000);
                    },
                    
                    drawSphere: (center, radius, color = 0xff0000, duration = 1) => {
                        const geometry = new THREE.SphereGeometry(radius, 8, 8);
                        const material = new THREE.MeshBasicMaterial({ 
                            color, 
                            wireframe: true 
                        });
                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.position.copy(center);
                        this.scene.add(mesh);
                        setTimeout(() => this.scene.remove(mesh), duration * 1000);
                    },
                    
                    log: (...args) => console.log(...args),
                    warn: (...args) => console.warn(...args),
                    error: (...args) => console.error(...args)
                };
                
                // Enhanced coroutine utilities
                function waitForSeconds(seconds) {
                    let elapsed = 0;
                    return function*() {
                        while(elapsed < seconds) {
                            elapsed += yield;
                        }
                    };
                }
                
                function waitUntil(condition) {
                    return function*() {
                        while(!condition()) yield;
                    };
                }
                
                // Entity query support
                function findEntitiesWithComponent(componentType) {
                    return this.engine.ecs.queryEntities(componentType);
                }
                
                // Tween integration
                function createTween(target, properties, duration, easing = 'linear') {
                    return this.engine.scriptingSystem.createTween(
                        target, properties, duration, easing
                    );
                }
                
                // Timer management
                function createTimer(delay, callback, repeats = false) {
                    const timer = new Timer(callback, delay, repeats);
                    this.engine.scriptingSystem.timers.push(timer);
                    return timer;
                }
                
                // Add these utilities to script context
                Object.assign(this, {
                    Debug,
                    stateMachine,
                    waitForSeconds,
                    waitUntil,
                    findEntitiesWithComponent,
                    createTween,
                    createTimer,
                    THREE: THREE // Explicitly expose THREE
                });
                
                ${obj.script}
            `;
            
            // Create a class from the script content
            const scriptCode = `
                class ObjectScript {
                    constructor(object, engine) {
                        this.object = object;
                        this.engine = engine;
                        this.transform = object.object3D;
                        this.scene = engine.scene;
                        this.input = engine.input;
                        this.events = engine.events;
                        
                        // Script name
                        this.scriptName = "${extractedScriptName}";
                        
                        // Serializable properties
                        this._properties = {};
                        
                        // Coroutines tracking
                        this._coroutines = [];
                        
                        // Lifecycle state
                        this._enabled = true;
                        
                        // Set up event subscriptions
                        this._eventSubscriptions = [];
                        
                        // Extended engine access
                        this.renderer = engine.renderer;
                        this.camera = engine.camera;
                        this.assets = engine.assets;
                        
                        // Behaviors
                        this._behaviors = [];
                        
                        // Make the behaviors library available
                        this.Behaviors = Behaviors;
                        
                        // Make Math utilities available
                        this.Math = {
                            // Vector classes
                            Vector2: THREE.Vector2,
                            Vector3: THREE.Vector3,
                            Vector4: THREE.Vector4,
                            
                            // Basic math helpers
                            lerp: (a, b, t) => a + (b - a) * t,
                            clamp: (val, min, max) => Math.min(Math.max(val, min), max),
                            smoothStep: (min, max, value) => {
                                const x = Math.max(0, Math.min(1, (value-min)/(max-min)));
                                return x*x*(3 - 2*x);
                            },
                            
                            // Angle conversions
                            toRadians: degrees => degrees * (Math.PI / 180),
                            toDegrees: radians => radians * (180 / Math.PI),
                            
                            // Random utilities
                            random: (min, max) => min + Math.random() * (max - min),
                            randomInt: (min, max) => Math.floor(min + Math.random() * (max - min + 1)),
                            randomFrom: array => array[Math.floor(Math.random() * array.length)],
                            weightedRandom: weights => {
                                const totalWeight = weights.reduce((sum, option) => sum + option.weight, 0);
                                let random = Math.random() * totalWeight;
                                
                                for (const option of weights) {
                                    random -= option.weight;
                                    if (random <= 0) return option.value;
                                }
                                return weights[weights.length - 1].value;
                            },
                            
                            // Quaternion wrapper
                            Quaternion: THREE.Quaternion,
                            
                            // Noise functions (placeholders)
                            Noise: {
                                perlin1D: x => Math.sin(x) * 0.5 + 0.5,
                                perlin2D: (x, y) => Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.5 + 0.5,
                                perlin3D: (x, y, z) => Math.sin(x * 0.1) * Math.cos(y * 0.1) * Math.sin(z * 0.1) * 0.5 + 0.5,
                                simplex2D: (x, y) => Math.sin(x * 0.1 + y * 0.1) * 0.5 + 0.5
                            },
                            
                            // Easing functions
                            Easing: {
                                easeInQuad: t => t * t,
                                easeOutQuad: t => t * (2 - t),
                                easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
                                easeInCubic: t => t * t * t,
                                easeOutCubic: t => (--t) * t * t + 1,
                                easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
                                bounceOut: t => {
                                    if (t < 1/2.75) {
                                        return 7.5625 * t * t;
                                    } else if (t < 2/2.75) {
                                        return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
                                    } else if (t < 2.5/2.75) {
                                        return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
                                    } else {
                                        return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
                                    }
                                }
                            },
                            
                            // Geometry helpers
                            Geometry: {
                                isPointInSphere: (point, center, radius) => point.distanceTo(center) <= radius,
                                sphereOverlap: (center1, radius1, center2, radius2) => center1.distanceTo(center2) <= (radius1 + radius2),
                                closestPointOnLine: (point, lineStart, lineEnd) => {
                                    const line = new THREE.Line3(lineStart, lineEnd);
                                    return line.closestPointToPoint(point, true, new THREE.Vector3());
                                },
                                lineIntersection: (a1, a2, b1, b2) => {
                                    const det = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
                                    if (det === 0) return null;
                                    const lambda = ((b2.y - b1.y) * (b2.x - a1.x) + (b1.x - b2.x) * (b2.y - a1.y)) / det;
                                    const gamma = ((a1.y - a2.y) * (b2.x - a1.x) + (a2.x - a1.x) * (b2.y - a1.y)) / det;
                                    if (lambda >= 0 && lambda <= 1 && gamma >= 0 && gamma <= 1) {
                                        return new THREE.Vector2(a1.x + lambda * (a2.x - a1.x), a1.y + lambda * (a2.y - a1.y));
                                    }
                                    return null;
                                }
                            },
                            
                            // Ray casting
                            Ray: class extends THREE.Ray {
                                constructor(origin, direction) {
                                    super(origin, direction);
                                }
                                intersectSphere(center, radius, target = new THREE.Vector3()) {
                                    return super.intersectSphere(new THREE.Sphere(center, radius), target);
                                }
                            }
                        };
                        
                        // Container data structures (Grid, Pool, QuadTree, Queue, StateMachine)
                        this.Containers = { 
                            // 2D Grid for tile-based games
                            Grid: class {
                                constructor(width, height, defaultValue = null) {
                                    this.width = width;
                                    this.height = height;
                                    this.cells = new Array(width * height).fill(defaultValue);
                                }
                                
                                isValidPosition(x, y) {
                                    return x >= 0 && x < this.width && y >= 0 && y < this.height;
                                }
                                
                                get(x, y) {
                                    if (!this.isValidPosition(x, y)) return null;
                                    return this.cells[y * this.width + x];
                                }
                                
                                set(x, y, value) {
                                    if (!this.isValidPosition(x, y)) return false;
                                    this.cells[y * this.width + x] = value;
                                    return true;
                                }
                                
                                getNeighbors(x, y) {
                                    const neighbors = [];
                                    const dirs = [[-1,0], [1,0], [0,-1], [0,1]];
                                    
                                    for (const [dx, dy] of dirs) {
                                        const nx = x + dx;
                                        const ny = y + dy;
                                        if (this.isValidPosition(nx, ny)) {
                                            neighbors.push({
                                                x: nx, 
                                                y: ny, 
                                                value: this.get(nx, ny)
                                            });
                                        }
                                    }
                                    
                                    return neighbors;
                                }
                                
                                forEach(callback) {
                                    for (let y = 0; y < this.height; y++) {
                                        for (let x = 0; x < this.width; x++) {
                                            callback(this.get(x, y), x, y);
                                        }
                                    }
                                }
                                
                                find(predicate) {
                                    const results = [];
                                    
                                    this.forEach((value, x, y) => {
                                        if (predicate(value)) {
                                            results.push({x, y, value});
                                        }
                                    });
                                    return results;
                                }
                                
                                fill(startX, startY, width, height, value) {
                                    for (let y = startY; y < startY + height; y++) {
                                        for (let x = startX; x < startX + width; x++) {
                                            if (this.isValidPosition(x, y)) {
                                                this.set(x, y, value);
                                            }
                                        }
                                    }
                                }
                            },
                            
                            // Object pool for efficient object reuse
                            Pool: class {
                                constructor(createFunc, resetFunc, initialSize = 0) {
                                    this.createFunc = createFunc;
                                    this.resetFunc = resetFunc;
                                    this.available = [];
                                    this.inUse = new Set();
                                    
                                    // Pre-allocate initial objects
                                    for (let i = 0; i < initialSize; i++) {
                                        this.available.push(this.createFunc());
                                    }
                                }
                                
                                get() {
                                    // Get object from pool or create new one
                                    const obj = this.available.length > 0 ? 
                                        this.available.pop() : 
                                        this.createFunc();
                                    
                                    this.inUse.add(obj);
                                    return obj;
                                }
                                
                                release(obj) {
                                    if (this.inUse.has(obj)) {
                                        this.inUse.delete(obj);
                                        this.resetFunc(obj);
                                        this.available.push(obj);
                                    }
                                }
                                
                                getStats() {
                                    return {
                                        available: this.available.length,
                                        active: this.inUse.size,
                                        size: this.available.length + this.inUse.size
                                    };
                                }
                            },
                            
                            // QuadTree for spatial partitioning
                            QuadTree: class {
                                constructor(x, y, width, height, maxObjects = 10, maxLevels = 5, level = 0) {
                                    this.bounds = { x, y, width, height };
                                    this.maxObjects = maxObjects;
                                    this.maxLevels = maxLevels;
                                    this.level = level;
                                    this.objects = [];
                                    this.nodes = [];
                                }
                                
                                clear() {
                                    this.objects = [];
                                    
                                    for (let i = 0; i < this.nodes.length; i++) {
                                        if (this.nodes[i]) {
                                            this.nodes[i].clear();
                                        }
                                    }
                                    
                                    this.nodes = [];
                                }
                                
                                split() {
                                    const nextLevel = this.level + 1;
                                    const subWidth = this.bounds.width / 2;
                                    const subHeight = this.bounds.height / 2;
                                    const x = this.bounds.x;
                                    const y = this.bounds.y;
                                    
                                    // Top right
                                    this.nodes[0] = new this.constructor(
                                        x + subWidth, y, subWidth, subHeight, 
                                        this.maxObjects, this.maxLevels, nextLevel
                                    );
                                    
                                    // Top left
                                    this.nodes[1] = new this.constructor(
                                        x, y, subWidth, subHeight, 
                                        this.maxObjects, this.maxLevels, nextLevel
                                    );
                                    
                                    // Bottom left
                                    this.nodes[2] = new this.constructor(
                                        x, y + subHeight, subWidth, subHeight, 
                                        this.maxObjects, this.maxLevels, nextLevel
                                    );
                                    
                                    // Bottom right
                                    this.nodes[3] = new this.constructor(
                                        x + subWidth, y + subHeight, subWidth, subHeight, 
                                        this.maxObjects, this.maxLevels, nextLevel
                                    );
                                }
                                
                                getIndex(rect) {
                                    let index = -1;
                                    const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
                                    const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);
                                    
                                    const topQuadrant = (rect.y < horizontalMidpoint);
                                    const bottomQuadrant = (rect.y + rect.height > horizontalMidpoint);
                                    
                                    if (rect.x < verticalMidpoint) {
                                        if (topQuadrant) {
                                            index = 1;
                                        } else if (bottomQuadrant) {
                                            index = 2;
                                        }
                                    } else if (rect.x + rect.width > verticalMidpoint) {
                                        if (topQuadrant) {
                                            index = 0;
                                        } else if (bottomQuadrant) {
                                            index = 3;
                                        }
                                    }
                                    
                                    return index;
                                }
                                
                                insert(rect) {
                                    let i = 0;
                                    
                                    // If we have subnodes, try to insert there
                                    if (this.nodes.length > 0) {
                                        const index = this.getIndex(rect);
                                        
                                        if (index !== -1) {
                                            this.nodes[index].insert(rect);
                                            return;
                                        }
                                    }
                                    
                                    // Add to this node's objects
                                    this.objects.push(rect);
                                    
                                    // Split if needed and move objects to subnodes
                                    if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
                                        if (this.nodes.length === 0) {
                                            this.split();
                                        }
                                        
                                        // Move objects to subnodes
                                        while (i < this.objects.length) {
                                            const index = this.getIndex(this.objects[i]);
                                            
                                            if (index !== -1) {
                                                this.nodes[index].insert(this.objects.splice(i, 1)[0]);
                                            } else {
                                                i++;
                                            }
                                        }
                                    }
                                }
                                
                                query(range, found = []) {
                                    if (!found) found = [];
                                    
                                    // Check if range intersects this node
                                    if (!this.intersects(range, this.bounds)) {
                                        return found;
                                    }
                                    
                                    // Add any objects that intersect
                                    for (let i = 0; i < this.objects.length; i++) {
                                        if (this.intersects(range, this.objects[i])) {
                                            found.push(this.objects[i]);
                                        }
                                    }
                                    
                                    // Recursively check subnodes
                                    for (let i = 0; i < this.nodes.length; i++) {
                                        if (this.nodes[i]) {
                                            this.nodes[i].query(range, found);
                                        }
                                    }
                                    
                                    return found;
                                }
                                
                                intersects(rectA, rectB) {
                                    return !(rectA.x + rectA.width < rectB.x ||
                                             rectA.y + rectA.height < rectB.y ||
                                             rectA.x > rectB.x + rectB.width ||
                                             rectA.y > rectB.y + rectB.height);
                                }
                                
                                visualize(scene) {
                                    // Create wireframe for this node
                                    const geometry = new THREE.BoxGeometry(
                                        this.bounds.width, 0.1, this.bounds.height
                                    );
                                    const material = new THREE.MeshBasicMaterial({
                                        color: 0x00ff00,
                                        wireframe: true
                                    });
                                    const mesh = new THREE.Mesh(geometry, material);
                                    
                                    mesh.position.set(
                                        this.bounds.x + this.bounds.width/2,
                                        0,
                                        this.bounds.y + this.bounds.height/2
                                    );
                                    
                                    scene.add(mesh);
                                    
                                    // Visualize subnodes
                                    for (let i = 0; i < this.nodes.length; i++) {
                                        if (this.nodes[i]) {
                                            this.nodes[i].visualize(scene);
                                        }
                                    }
                                }
                            },
                            
                            // Simple queue implementation
                            Queue: class {
                                constructor() {
                                    this.items = [];
                                }
                                
                                enqueue(item) {
                                    this.items.push(item);
                                }
                                
                                dequeue() {
                                    if (this.isEmpty()) return null;
                                    return this.items.shift();
                                }
                                
                                peek() {
                                    if (this.isEmpty()) return null;
                                    return this.items[0];
                                }
                                
                                isEmpty() {
                                    return this.items.length === 0;
                                }
                                
                                size() {
                                    return this.items.length;
                                }
                                
                                clear() {
                                    this.items = [];
                                }
                            },
                            
                            // State machine
                            StateMachine: class {
                                constructor(initialState) {
                                    this.states = {};
                                    this.currentState = null;
                                    this.previousState = null;
                                    
                                    if (initialState) {
                                        this.currentState = initialState;
                                    }
                                }
                                
                                addState(name, callbacks) {
                                    this.states[name] = {
                                        name,
                                        onEnter: callbacks.onEnter || (() => {}),
                                        onUpdate: callbacks.onUpdate || (() => {}),
                                        onExit: callbacks.onExit || (() => {})
                                    };
                                    
                                    // Set as initial state if none is set
                                    if (!this.currentState) {
                                        this.currentState = name;
                                    }
                                    
                                    return this;
                                }
                                
                                transition(newState) {
                                    if (!this.states[newState] || newState === this.currentState) return;
                                    
                                    // Exit current state
                                    if (this.currentState && this.states[this.currentState]) {
                                        this.states[this.currentState].onExit();
                                    }
                                    
                                    // Store previous state
                                    this.previousState = this.currentState;
                                    
                                    // Enter new state
                                    this.currentState = newState;
                                    this.states[this.currentState].onEnter();
                                }
                                
                                update(deltaTime) {
                                    if (this.currentState && this.states[this.currentState]) {
                                        this.states[this.currentState].onUpdate(deltaTime);
                                    }
                                }
                                
                                getCurrentState() {
                                    return this.currentState;
                                }
                                
                                getPreviousState() {
                                    return this.previousState;
                                }
                                
                                isInState(stateName) {
                                    return this.currentState === stateName;
                                }
                            }
                        };
// ... existing code ...

                    // Add a behavior to this script
                    addBehavior(behaviorClass, ...args) {
                        const behavior = new behaviorClass(this, ...args);
                        this._behaviors.push(behavior);
                        return behavior;
                    }
                    
                    // Update all behaviors
                    _updateBehaviors(deltaTime) {
                        for (const behavior of this._behaviors) {
                            if (behavior.enabled) {
                                behavior.update(deltaTime);
                            }
                        }
                    }
                    
                    // Coroutine support
                    startCoroutine(generator) {
                        const coroutine = { generator, done: false };
                        this._coroutines.push(coroutine);
                        return coroutine;
                    }
                    
                    stopCoroutine(coroutine) {
                        const index = this._coroutines.indexOf(coroutine);
                        if (index !== -1) this._coroutines.splice(index, 1);
                    }
                    
                    // Update all running coroutines
                    _updateCoroutines(deltaTime) {
                        for (let i = this._coroutines.length - 1; i >= 0; i--) {
                            const coroutine = this._coroutines[i];
                            if (coroutine.done) {
                                this._coroutines.splice(i, 1);
                                continue;
                            }
                            
                            try {
                                const result = coroutine.generator.next(deltaTime);
                                coroutine.done = result.done;
                                
                                // Handle Promise yields for asynchronous operations
                                if (!coroutine.done && result.value instanceof Promise) {
                                    // Pause coroutine execution until Promise resolves
                                    coroutine.waiting = true;
                                    result.value.then(
                                        (resolvedValue) => {
                                            // Resume coroutine with the resolved value
                                            coroutine.waiting = false;
                                            try {
                                                const nextResult = coroutine.generator.next(resolvedValue);
                                                coroutine.done = nextResult.done;
                                            } catch (e) {
                                                console.error('Error resuming coroutine:', e);
                                                coroutine.done = true;
                                            }
                                        },
                                        (error) => {
                                            // Handle Promise rejection
                                            try {
                                                const nextResult = coroutine.generator.throw(error);
                                                coroutine.done = nextResult.done;
                                            } catch (e) {
                                                console.error('Error handling rejected Promise in coroutine:', e);
                                                coroutine.done = true;
                                            }
                                        }
                                    );
                                }
                            } catch (e) {
                                console.error('Error in coroutine:', e);
                                coroutine.done = true;
                            }
                        }
                    }
                    
                    // Event system integration
                    on(eventName, callback) {
                        const subscription = this.engine.events.on(eventName, callback, this);
                        this._eventSubscriptions.push(subscription);
                        return subscription;
                    }
                    
                    once(eventName, callback) {
                        const subscription = this.engine.events.once(eventName, callback, this);
                        this._eventSubscriptions.push(subscription);
                        return subscription;
                    }
                    
                    off(eventName, callback) {
                        this.engine.events.off(eventName, callback, this);
                        this._eventSubscriptions = this._eventSubscriptions.filter(sub => 
                            sub.callback !== callback
                        );
                    }
                    
                    emit(eventName, data) {
                        this.engine.events.emit(eventName, data);
                    }
                    
                    // Tagging system
                    addTag(tag) {
                        this.engine.scriptingSystem.addTag(this.object, tag);
                    }
                    
                    removeTag(tag) {
                        this.engine.scriptingSystem.removeTag(this.object, tag);
                    }
                    
                    hasTag(tag) {
                        return this.engine.scriptingSystem.hasTag(this.object, tag);
                    }
                    
                    // Query components/objects
                    findObjectsByTag(tag) {
                        return this.engine.scriptingSystem.getObjectsByTag(tag);
                    }
                    
                    findObjectsByScript(scriptName) {
                        return this.engine.scriptingSystem.getObjectsByScript(scriptName);
                    }
                    
                    findObjectsByProperty(propName, value) {
                        return this.engine.objects.filter(obj => 
                            obj[propName] === value || 
                            (obj.object3D && obj.object3D[propName] === value)
                        );
                    }
                    
                    findChildrenRecursive(filterFn = null) {
                        const results = [];
                        
                        const traverse = (object) => {
                            if (!object) return;
                            
                            for (const child of object.children) {
                                const engineObj = this.engine.getObjectByThreeJsObject(child);
                                if (engineObj && (!filterFn || filterFn(engineObj))) {
                                    results.push(engineObj);
                                }
                                traverse(child);
                            }
                        };
                        
                        traverse(this.transform);
                        return results;
                    }
                    
                    // Input helpers
                    isKeyPressed(keyCode) {
                        return this.input.isKeyPressed(keyCode);
                    }
                    
                    isKeyDown(keyCode) {
                        return this.input.isKeyDown(keyCode);
                    }
                    
                    isKeyUp(keyCode) {
                        return this.input.isKeyUp(keyCode);
                    }
                    
                    isMouseButtonPressed(button) {
                        return this.input.isMouseButtonPressed(button);
                    }
                    
                    isMouseButtonDown(button) {
                        return this.input.isMouseButtonDown(button);
                    }
                    
                    isMouseButtonUp(button) {
                        return this.input.isMouseButtonUp(button);
                    }
                    
                    getMousePosition() {
                        return {...this.input.mousePosition};
                    }
                    
                    getMouseWorldPosition() {
                        return this.input.mouseWorldPosition.clone();
                    }
                    
                    // Hierarchy traversal
                    findChild(name) {
                        for (let i = 0; i < this.transform.children.length; i++) {
                            const child = this.transform.children[i];
                            if (child.name === name) {
                                return this.engine.getObjectByThreeJsObject(child);
                            }
                        }
                        return null;
                    }
                    
                    getChildren() {
                        return this.transform.children.map(child => 
                            this.engine.getObjectByThreeJsObject(child)
                        ).filter(obj => obj !== null);
                    }
                    
                    getParent() {
                        if (this.object.parent) {
                            return this.engine.getObjectById(this.object.parent);
                        }
                        return null;
                    }
                    
                    getRootObject() {
                        let current = this.object;
                        while (current.parent) {
                            current = this.engine.getObjectById(current.parent);
                            if (!current) break;
                        }
                        return current;
                    }
                    
                    findObjectInChildren(name, recursive = true) {
                        const children = this.getChildren();
                        for (const child of children) {
                            if (child.name === name) return child;
                            
                            if (recursive && child.scriptInstance) {
                                const found = child.scriptInstance.findObjectInChildren(name, true);
                                if (found) return found;
                            }
                        }
                        return null;
                    }
                    
                    getChildrenRecursive() {
                        return this.engine.getChildrenRecursive(this.object);
                    }
                    
                    setParent(newParent) {
                        if (!newParent) {
                            return this.engine.removeFromParent(this.object);
                        } else {
                            return this.engine.setParent(this.object, newParent);
                        }
                    }
                    
                    // Property serialization
                    setProperty(name, value) {
                        this._properties[name] = value;
                    }
                    
                    getProperty(name, defaultValue) {
                        return name in this._properties ? this._properties[name] : defaultValue;
                    }
                    
                    getAllProperties() {
                        return {...this._properties};
                    }
                    
                    // Enable/disable behavior
                    enable() {
                        if (!this._enabled && this.onEnable) this.onEnable();
                        this._enabled = true;
                    }
                    
                    disable() {
                        if (this._enabled && this.onDisable) this.onDisable();
                        this._enabled = false;
                    }
                    
                    isEnabled() {
                        return this._enabled;
                    }
                    
                    // Prefab instantiation
                    instantiate(prefabName, position, rotation) {
                        return this.engine.instantiatePrefab(prefabName, position, rotation);
                    }
                    
                    // Cleanup all event subscriptions
                    _cleanupEventSubscriptions() {
                        for (const subscription of this._eventSubscriptions) {
                            subscription.remove();
                        }
                        this._eventSubscriptions = [];
                    }
                    
                    // Material system access
                    createMaterial(type = 'standard', properties = {}) {
                        const materialTypes = {
                            'basic': THREE.MeshBasicMaterial,
                            'standard': THREE.MeshStandardMaterial,
                            'phong': THREE.MeshPhongMaterial,
                            'lambert': THREE.MeshLambertMaterial,
                            'toon': THREE.MeshToonMaterial,
                            'normal': THREE.MeshNormalMaterial
                        };
                        
                        const MaterialClass = materialTypes[type] || THREE.MeshStandardMaterial;
                        return new MaterialClass(properties);
                    }
                    
                    // Renderer access and modification
                    setRenderTarget(target) {
                        if (this.renderer) {
                            this.renderer.setRenderTarget(target);
                        }
                    }
                    
                    createRenderTarget(width, height, options = {}) {
                        return new THREE.WebGLRenderTarget(width, height, options);
                    }
                    
                    // Post-processing
                    setupPostProcessing(passes = []) {
                        if (!this.engine.composer) {
                            console.warn('Post-processing not initialized in engine');
                            return false;
                        }
                        
                        // Add custom passes to the composer
                        for (const pass of passes) {
                            this.engine.composer.addPass(pass);
                        }
                        return true;
                    }
                    
                    // Advanced material manipulation
                    updateShaderMaterial(material, uniforms) {
                        if (!material || material.type !== 'ShaderMaterial') {
                            console.warn('Not a shader material');
                            return;
                        }
                        
                        for (const [key, value] of Object.entries(uniforms)) {
                            if (material.uniforms[key]) {
                                material.uniforms[key].value = value;
                            }
                        }
                    }
                    
                    createShaderMaterial(vertexShader, fragmentShader, uniforms = {}) {
                        return new THREE.ShaderMaterial({
                            vertexShader,
                            fragmentShader,
                            uniforms
                        });
                    }
                    
                    // Scene manipulation utilities
                    createObject(geometryType, material = null, position = null) {
                        const geometries = {
                            'box': new THREE.BoxGeometry(1, 1, 1),
                            'sphere': new THREE.SphereGeometry(0.5, 32, 32),
                            'cylinder': new THREE.CylinderGeometry(0.5, 0.5, 1, 32),
                            'cone': new THREE.ConeGeometry(0.5, 1, 32),
                            'plane': new THREE.PlaneGeometry(1, 1),
                            'torus': new THREE.TorusGeometry(0.5, 0.2, 16, 32)
                        };
                        
                        const geometry = geometries[geometryType] || geometries.box;
                        const mat = material || new THREE.MeshStandardMaterial();
                        const mesh = new THREE.Mesh(geometry, mat);
                        
                        if (position) {
                            mesh.position.copy(position);
                        }
                        
                        this.scene.add(mesh);
                        return mesh;
                    }
                    
                    // Asset loading methods
                    loadTexture(url, options = {}) {
                        return this.assets.load(url, 'texture', options);
                    }
                    
                    loadModel(url, type = 'gltf', options = {}) {
                        return this.assets.load(url, type, options);
                    }
                    
                    loadAudio(url, options = {}) {
                        return this.assets.load(url, 'audio', options);
                    }
                    
                    getAsset(url, type) {
                        return this.assets.get(url, type);
                    }
                    
                    unloadAsset(url, type) {
                        this.assets.unload(url, type);
                    }
                    
                    createMaterialFromTexture(textureUrl, materialType = 'standard', properties = {}) {
                        return this.assets.createMaterialFromTexture(textureUrl, materialType, properties);
                    }
                    
                    // Add the newly requested lifecycle functions
                    gameLoop() {
                        // Main game loop function that manages the overall flow
                        console.log("gameLoop called");
                    }

                    update(deltaTime) {
                        // Called every frame with time difference in seconds
                        // This method is already part of the script lifecycle
                    }

                    debug() {
                        // For debugging functionality during development
                        console.log("debug called", this);
                        
                        // Return useful debug info
                        return {
                            name: this.object.name,
                            position: this.transform.position.clone(),
                            properties: this._properties
                        };
                    }
                    
                    fixedUpdate(fixedDeltaTime) {
                        // Physics and other time-sensitive updates at fixed intervals
                        // Called at consistent time intervals regardless of frame rate
                    }
                    
                    onDestroy() {
                        // Called when object is being destroyed
                        // Clean up resources and event listeners
                        this._cleanupEventSubscriptions();
                        
                        for (const behavior of this._behaviors) {
                            if (typeof behavior.onDestroy === 'function') {
                                behavior.onDestroy();
                            }
                        }
                    }
                    
                    lateUpdate(deltaTime) {
                        // Called after all objects' updates have been called
                        // Good for camera follow and finalization logic
                    }
                    
                    init() {
                        // Initialization function that can be called manually
                        // Useful for setup that doesn't fit in awake/start lifecycle
                        console.log("Manually initializing " + this.object.name);
                        return true;
                    }
                }
            `;
            
            // Create a script instance with enhanced features
            const scriptInstance = new Function('THREE', 'Behaviors', 'objectRef', 'engineRef', scriptCode)(THREE, Behaviors, obj, this.engine);
            
            // Store the instance
            this.scriptInstances.set(obj.id, scriptInstance);
            
            // Update script name index for querying
            const scriptName = scriptInstance.scriptName || "UnnamedScript";
            if (!this.objectsByScript.has(scriptName)) {
                this.objectsByScript.set(scriptName, []);
            }
            
            const scriptObjects = this.objectsByScript.get(scriptName);
            if (!scriptObjects.includes(obj)) {
                scriptObjects.push(obj);
            }
            
            return scriptInstance;
        } catch (e) {
            console.error(`Error creating script instance for ${obj.name}:`, e);
            return null;
        }
    }
    
    initializeScripts() {
        this.scriptInstances.clear();
        
        this.engine.objects.forEach(obj => {
            if (obj.script) {
                obj.scriptInitialized = false;
                obj.scriptInstance = null;
            }
        });
        
        // Reset any tags and script references
        this.objectsByTag.clear();
        this.objectsByScript.clear();
        this.weakRefs = new WeakMap();
    }

    updateScripts(deltaTime) {
        // Update game loop
        this.gameLoop.update(deltaTime);
        
        // Update tweens
        this.updateTweens(deltaTime);
        
        // Update timers
        this.updateTimers(deltaTime);
        
        // Update all script instances
        this.engine.objects.forEach(obj => {
            if (this.engine.isPlaying && obj.script) {
                try {
                    if (!obj.scriptInstance) {
                        // Create script instance
                        obj.scriptInstance = this.createScriptInstance(obj);
                        
                        // Restore serialized properties if they exist
                        if (obj.scriptProperties) {
                            Object.assign(obj.scriptInstance._properties, obj.scriptProperties);
                        }
                        
                        // Call lifecycle methods if they exist
                        if (obj.scriptInstance && typeof obj.scriptInstance.awake === 'function') {
                            obj.scriptInstance.awake();
                        }
                        
                        // Call start method if it exists
                        if (obj.scriptInstance && typeof obj.scriptInstance.start === 'function') {
                            obj.scriptInstance.start();
                        }
                        
                        // Mark script as initialized
                        obj.scriptInitialized = true;
                    }
                    
                    // Only update enabled scripts
                    if (obj.scriptInstance && obj.scriptInstance.isEnabled()) {
                        // Call update method if it exists
                        if (typeof obj.scriptInstance.update === 'function') {
                            obj.scriptInstance.update(deltaTime);
                        }
                        
                        // Update behaviors if any
                        if (obj.scriptInstance._behaviors && obj.scriptInstance._behaviors.length > 0) {
                            obj.scriptInstance._updateBehaviors(deltaTime);
                        }
                        
                        // Call lateUpdate if it exists (after all regular updates)
                        if (typeof obj.scriptInstance.lateUpdate === 'function') {
                            obj.scriptInstance.lateUpdate(deltaTime);
                        }
                        
                        // Update any coroutines
                        obj.scriptInstance._updateCoroutines(deltaTime);
                        
                        // Store serialized properties back to the object
                        obj.scriptProperties = {...obj.scriptInstance._properties};
                    }
                } catch (e) {
                    console.error(`Error executing script for ${obj.name}:`, e);
                    // Disable script to prevent continuous errors
                    obj.scriptInstance = null;
                }
            }
        });
    }
    
    hotReloadScript(obj) {
        if (!obj.script) return false;
        
        try {
            // Save current property state if instance exists
            const props = obj.scriptInstance ? 
                obj.scriptInstance._properties : {};
            
            // Create a new script instance
            obj.scriptInitialized = false;
            obj.scriptInstance = null;
            obj.scriptInstance = this.createScriptInstance(obj);
            
            // Restore properties
            if (obj.scriptInstance) {
                Object.assign(obj.scriptInstance._properties, props);
                
                // Call start since we recreated the instance
                if (this.engine.isPlaying && typeof obj.scriptInstance.start === 'function') {
                    obj.scriptInstance.start();
                }
                
                return true;
            }
        } catch (e) {
            console.error(`Error hot-reloading script for ${obj.name}:`, e);
        }
        
        return false;
    }
    
    validateScript(scriptCode) {
        try {
            // Validate script by creating a class prototype
            const dummyCode = `
                class ObjectScript {
                    constructor(object, engine) {
                        this.object = object;
                        this.engine = engine;
                        this.transform = object.object3D;
                        this.scene = engine.scene;
                        this.input = engine.input;
                        this.events = engine.events;
                        
                        // Make THREE available
                        const THREE = engine.renderer.constructor.prototype.constructor;
                    }
                    
                    ${scriptCode}
                }
            `;
            new Function('THREE', dummyCode)(THREE);
            return { valid: true };
        } catch (e) {
            return { valid: false, error: e.message };
        }
    }
    
    cleanupScripts() {
        // ... existing code ...
        
        // Also terminate any web workers
        if (this.engine.ecs) {
            this.engine.ecs.terminateAllWorkers();
        }
        
        // ... existing code ...
    }
}