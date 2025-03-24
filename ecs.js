import * as THREE from 'three';

/**
 * Entity-Component System (ECS) for Three.js Game Engine
 * Allows composable, modular components instead of monolithic scripts
 */

export class Component {
    constructor() {
        this.entity = null;
        this.enabled = true;
        this._properties = {};
        this.dependencies = []; // Array of required component types
    }
    
    // Called when component is added to entity
    onAttach(entity) {
        this.entity = entity;
    }
    
    // Called when component is removed from entity
    onDetach() {
        this.entity = null;
    }
    
    // Lifecycle methods
    awake() {}
    start() {}
    update(deltaTime) {}
    lateUpdate(deltaTime) {}
    onEnable() {}
    onDisable() {}
    
    // Property serialization
    setProperty(name, value) {
        this._properties[name] = value;
    }
    
    getProperty(name, defaultValue) {
        return name in this._properties ? this._properties[name] : defaultValue;
    }
    
    // Enable/disable
    enable() {
        if (!this.enabled) {
            this.enabled = true;
            this.onEnable();
        }
    }
    
    disable() {
        if (this.enabled) {
            this.enabled = false;
            this.onDisable();
        }
    }
    
    // Add method to define dependencies
    requires(...componentTypes) {
        this.dependencies = componentTypes;
        return this;
    }
    
    // Check if dependencies are satisfied
    hasDependenciesMet() {
        if (!this.entity || this.dependencies.length === 0) return true;
        
        return this.dependencies.every(depType => 
            this.entity.hasComponent(depType)
        );
    }
}

export class Entity {
    constructor(engine, obj) {
        this.engine = engine;
        this.obj = obj;
        this.components = new Map();
        this.transform = obj.object3D;
        this.name = obj.name;
        this.id = obj.id;
    }
    
    // Add a component to this entity
    addComponent(componentType, ...args) {
        const component = new componentType(...args);
        
        // Check if dependencies are registered components
        for (const depType of component.dependencies) {
            if (!this.engine.ecs.componentTypes.has(depType.name)) {
                console.warn(`Dependency ${depType.name} is not registered`);
                this.engine.ecs.registerComponent(depType);
            }
            
            // Add dependency component if not already present
            if (!this.hasComponent(depType)) {
                this.addComponent(depType);
            }
        }
        
        component.onAttach(this);
        this.components.set(componentType.name, component);
        return component;
    }
    
    // Get a component by type
    getComponent(componentType) {
        return this.components.get(componentType.name);
    }
    
    // Check if entity has a component
    hasComponent(componentType) {
        return this.components.has(componentType.name);
    }
    
    // Remove a component
    removeComponent(componentType) {
        const component = this.components.get(componentType.name);
        if (component) {
            component.onDetach();
            this.components.delete(componentType.name);
        }
    }
    
    // Initialize all components
    initializeComponents() {
        // Call awake on all components
        for (const component of this.components.values()) {
            if (component.enabled) {
                component.awake();
            }
        }
        
        // Call start on all components
        for (const component of this.components.values()) {
            if (component.enabled) {
                component.start();
            }
        }
    }
    
    // Update all components
    updateComponents(deltaTime) {
        // Call update on all components
        for (const component of this.components.values()) {
            if (component.enabled) {
                component.update(deltaTime);
            }
        }
    }
    
    // Late update all components
    lateUpdateComponents(deltaTime) {
        // Call lateUpdate on all components
        for (const component of this.components.values()) {
            if (component.enabled) {
                component.lateUpdate(deltaTime);
            }
        }
    }
}

/**
 * Entity-Component System (ECS) Manager
 * Manages entities and their components for efficient game object composition
 */
export class ECSManager {
    /**
     * Creates a new ECS Manager
     * @param {GameEngine} engine - Reference to the main game engine
     */
    constructor(engine) {
        this.engine = engine;
        this.entities = new Map();
        this.componentTypes = new Map();
        this.spatialIndex = new QuadTree(0, 0, 1000, 1000, 8); // Main spatial index
        this.workers = new Map(); // WebWorker pool
    }
    
    // Register a component type
    registerComponent(componentType) {
        this.componentTypes.set(componentType.name, componentType);
    }
    
    // Create an entity from an engine object
    createEntity(obj) {
        const entity = new Entity(this.engine, obj);
        this.entities.set(obj.id, entity);
        return entity;
    }
    
    // Get entity by id
    getEntity(id) {
        return this.entities.get(id);
    }
    
    // Get entity from an engine object
    getEntityFromObject(obj) {
        if (!obj) return null;
        return this.entities.get(obj.id);
    }
    
    // Remove an entity
    removeEntity(id) {
        this.entities.delete(id);
    }
    
    // Initialize all entities with dependency order
    initializeEntities() {
        // Sort entities by dependency order
        const orderedComponents = [];
        const visiting = new Set();
        const visited = new Set();
        
        // Helper for topological sort
        const visit = (entity, component) => {
            const key = `${entity.id}-${component.constructor.name}`;
            
            if (visited.has(key)) return;
            if (visiting.has(key)) {
                console.warn('Circular dependency detected in components:', key);
                return;
            }
            
            visiting.add(key);
            
            // Process dependencies first
            for (const depType of component.dependencies) {
                const depComponent = entity.getComponent(depType);
                if (depComponent) {
                    visit(entity, depComponent);
                }
            }
            
            visiting.delete(key);
            visited.add(key);
            orderedComponents.push({entity, component});
        };
        
        // Build initialization order
        for (const entity of this.entities.values()) {
            for (const component of entity.components.values()) {
                visit(entity, component);
            }
        }
        
        // Initialize in dependency order
        for (const {entity, component} of orderedComponents) {
            if (component.enabled) {
                component.awake();
            }
        }
        
        // Call start after all awake calls
        for (const {entity, component} of orderedComponents) {
            if (component.enabled) {
                component.start();
            }
        }
        
        // Initialize spatial index
        this.updateSpatialIndex();
    }
    
    // Update with spatial index refresh
    updateEntities(deltaTime) {
        for (const entity of this.entities.values()) {
            entity.updateComponents(deltaTime);
        }
        
        // Update spatial index every frame
        this.updateSpatialIndex();
    }
    
    // Late update all entities
    lateUpdateEntities(deltaTime) {
        for (const entity of this.entities.values()) {
            entity.lateUpdateComponents(deltaTime);
        }
    }
    
    // Add spatial querying methods
    queryArea(x, z, width, height) {
        const area = {
            x: x,
            y: z,  // Using Z as Y for 2D quadtree
            width: width,
            height: height
        };
        
        return this.spatialIndex.query(area).map(item => item.entity);
    }
    
    queryRadius(x, z, radius) {
        // Query the square area that contains the circle
        const areaResults = this.queryArea(x - radius, z - radius, radius * 2, radius * 2);
        
        // Filter to just the entities actually in the radius
        return areaResults.filter(entity => {
            const pos = entity.transform.position;
            const dx = pos.x - x;
            const dz = pos.z - z;
            return (dx * dx + dz * dz) <= (radius * radius);
        });
    }
    
    // Update spatial index
    updateSpatialIndex() {
        this.spatialIndex.clear();
        
        for (const entity of this.entities.values()) {
            const transform = entity.transform;
            if (transform) {
                // Create a rectangle for the entity (using bounding box)
                let boundingBox;
                if (entity.obj.object3D.geometry) {
                    // Use geometry bounds if available
                    if (entity.obj.object3D.geometry.boundingBox === null) {
                        entity.obj.object3D.geometry.computeBoundingBox();
                    }
                    boundingBox = entity.obj.object3D.geometry.boundingBox.clone();
                    boundingBox.applyMatrix4(entity.obj.object3D.matrixWorld);
                } else {
                    // Estimate bounds based on position and arbitrary size
                    const pos = transform.position;
                    const size = 2; // Default size
                    boundingBox = new THREE.Box3(
                        new THREE.Vector3(pos.x - size/2, pos.y - size/2, pos.z - size/2),
                        new THREE.Vector3(pos.x + size/2, pos.y + size/2, pos.z + size/2)
                    );
                }
                
                // Convert 3D bounds to 2D for quadtree (using XZ plane)
                const rect = {
                    x: boundingBox.min.x,
                    y: boundingBox.min.z, // Using Z as Y for 2D quadtree
                    width: boundingBox.max.x - boundingBox.min.x,
                    height: boundingBox.max.z - boundingBox.min.z,
                    entity: entity
                };
                
                this.spatialIndex.insert(rect);
            }
        }
    }
    
    // Query entities with specific components
    queryEntities(...componentTypes) {
        const componentNames = componentTypes.map(t => t.name);
        return Array.from(this.entities.values()).filter(entity => 
            componentNames.every(name => entity.components.has(name))
        );
    }
    
    // Clear all entities
    clear() {
        this.entities.clear();
    }
    
    /**
     * Terminates all running web workers
     * Cleans up resources when exiting play mode
     */
    terminateAllWorkers() {
        for (const [id, worker] of this.workers) {
            if (worker && worker.terminate) {
                worker.terminate();
                this.workers.delete(id);
            }
        }
    }
}

// Define QuadTree class for spatial partitioning
class QuadTree {
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
        this.nodes[0] = new QuadTree(
            x + subWidth, y, subWidth, subHeight, 
            this.maxObjects, this.maxLevels, nextLevel
        );
        
        // Top left
        this.nodes[1] = new QuadTree(
            x, y, subWidth, subHeight, 
            this.maxObjects, this.maxLevels, nextLevel
        );
        
        // Bottom left
        this.nodes[2] = new QuadTree(
            x, y + subHeight, subWidth, subHeight, 
            this.maxObjects, this.maxLevels, nextLevel
        );
        
        // Bottom right
        this.nodes[3] = new QuadTree(
            x + subWidth, y + subHeight, subWidth, subHeight, 
            this.maxObjects, this.maxLevels, nextLevel
        );
    }
    
    getIndex(rect) {
        let index = -1;
        const verticalMidpoint = this.bounds.x + (this.bounds.width / 2);
        const horizontalMidpoint = this.bounds.y + (this.bounds.height / 2);
        
        const topQuadrant = (rect.y < horizontalMidpoint && 
                            rect.y + rect.height < horizontalMidpoint);
        const bottomQuadrant = (rect.y >= horizontalMidpoint);
        
        if (rect.x < verticalMidpoint && 
            rect.x + rect.width < verticalMidpoint) {
            if (topQuadrant) {
                index = 1;
            } else if (bottomQuadrant) {
                index = 2;
            }
        } else if (rect.x >= verticalMidpoint) {
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
}

// Sample components that can be used with the ECS
export class TransformComponent extends Component {
    constructor() {
        super();
        this.setProperty('position', { x: 0, y: 0, z: 0 });
        this.setProperty('rotation', { x: 0, y: 0, z: 0 });
        this.setProperty('scale', { x: 1, y: 1, z: 1 });
    }
    
    awake() {
        this.position = this.entity.transform.position;
        this.rotation = this.entity.transform.rotation;
        this.scale = this.entity.transform.scale;
    }
    
    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.setProperty('position', { x, y, z });
    }
    
    setRotation(x, y, z) {
        this.rotation.set(x, y, z);
        this.setProperty('rotation', { x, y, z });
    }
    
    setScale(x, y, z) {
        this.scale.set(x, y, z);
        this.setProperty('scale', { x, y, z });
    }
}

export class RenderComponent extends Component {
    constructor() {
        super();
        this.setProperty('visible', true);
        this.setProperty('material', {
            color: '#4b80ff',
            wireframe: false,
            transparent: false,
            opacity: 1.0
        });
    }
    
    awake() {
        this.mesh = this.entity.transform;
        this.visible = this.getProperty('visible', true);
        
        if (this.mesh.material) {
            const materialProps = this.getProperty('material', {});
            if (materialProps.color) this.mesh.material.color.set(materialProps.color);
            if ('wireframe' in materialProps) this.mesh.material.wireframe = materialProps.wireframe;
            if ('transparent' in materialProps) this.mesh.material.transparent = materialProps.transparent;
            if ('opacity' in materialProps) this.mesh.material.opacity = materialProps.opacity;
        }
    }
    
    setVisible(visible) {
        this.visible = visible;
        this.mesh.visible = visible;
        this.setProperty('visible', visible);
    }
    
    setMaterialProperty(property, value) {
        if (this.mesh.material) {
            if (property === 'color') {
                this.mesh.material.color.set(value);
            } else {
                this.mesh.material[property] = value;
            }
            
            const materialProps = this.getProperty('material', {});
            materialProps[property] = value;
            this.setProperty('material', materialProps);
        }
    }
}

// Sample physics component with dependency on transform
export class PhysicsComponent extends Component {
    constructor() {
        super();
        this.setProperty('velocity', { x: 0, y: 0, z: 0 });
        this.setProperty('useGravity', true);
        this.setProperty('mass', 1.0);
        this.setProperty('isKinematic', false);
        this.setProperty('bounciness', 0.5);
        
        // Define dependency on TransformComponent
        this.requires(TransformComponent);
    }
    
    awake() {
        this.boundingBox = new THREE.Box3();
        if (this.entity?.transform) {
            this.boundingBox.setFromObject(this.entity.transform);
        }
        this.velocity = new THREE.Vector3(
            (this.getProperty('velocity') && this.getProperty('velocity').x) || 0,
            (this.getProperty('velocity') && this.getProperty('velocity').y) || 0,
            (this.getProperty('velocity') && this.getProperty('velocity').z) || 0
        );
        this.useGravity = this.getProperty('useGravity', true);
        this.mass = this.getProperty('mass', 1.0);
        this.isKinematic = this.getProperty('isKinematic', false);
        this.bounciness = this.getProperty('bounciness', 0.5);
    }
    
    update(deltaTime) {
        if (!this.entity?.transform?.position || !this.velocity) return;
        if (this.isKinematic) return;
        
        // Apply gravity if enabled
        if (this.useGravity) {
            const gravity = this.entity.engine.config?.physics?.gravity || -9.8;
            this.velocity.y += gravity * deltaTime;
        }
        
        // Update position based on velocity
        this.entity.transform.position.x += this.velocity.x * deltaTime;
        this.entity.transform.position.y += this.velocity.y * deltaTime;
        this.entity.transform.position.z += this.velocity.z * deltaTime;
        
        // Simple floor collision check
        if (this.entity.transform.position.y < 0) {
            this.entity.transform.position.y = 0;
            this.velocity.y = -this.velocity.y * this.bounciness;
        }
        
        // Update bounding box for the entity
        this.boundingBox.setFromObject(this.entity.transform);
        
        // Serialize updated velocity properties
        this.setProperty('velocity', { 
            x: this.velocity.x, 
            y: this.velocity.y, 
            z: this.velocity.z 
        });
    }
    
    applyForce(force) {
        this.velocity.add(force.clone().divideScalar(this.mass));
    }
    
    setVelocity(x, y, z) {
        this.velocity.set(x, y, z);
        this.setProperty('velocity', { x, y, z });
    }
}