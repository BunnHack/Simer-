/**
 * Entity-Component System (ECS) for Three.js Game Engine
 * Allows composable, modular components instead of monolithic scripts
 */

export class Component {
    constructor() {
        this.entity = null;
        this.enabled = true;
        this._properties = {};
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

export class ECSManager {
    constructor(engine) {
        this.engine = engine;
        this.entities = new Map();
        this.componentTypes = new Map();
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
    
    // Initialize all entities
    initializeEntities() {
        for (const entity of this.entities.values()) {
            entity.initializeComponents();
        }
    }
    
    // Update all entities
    updateEntities(deltaTime) {
        for (const entity of this.entities.values()) {
            entity.updateComponents(deltaTime);
        }
    }
    
    // Late update all entities
    lateUpdateEntities(deltaTime) {
        for (const entity of this.entities.values()) {
            entity.lateUpdateComponents(deltaTime);
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

export class PhysicsComponent extends Component {
    constructor() {
        super();
        this.setProperty('velocity', { x: 0, y: 0, z: 0 });
        this.setProperty('useGravity', true);
        this.setProperty('mass', 1.0);
        this.setProperty('isKinematic', false);
        this.setProperty('bounciness', 0.5);
    }
    
    awake() {
        this.velocity = new THREE.Vector3(
            this.getProperty('velocity').x || 0,
            this.getProperty('velocity').y || 0,
            this.getProperty('velocity').z || 0
        );
        this.useGravity = this.getProperty('useGravity', true);
        this.mass = this.getProperty('mass', 1.0);
        this.isKinematic = this.getProperty('isKinematic', false);
        this.bounciness = this.getProperty('bounciness', 0.5);
        
        // Create bounding box for collision detection
        this.boundingBox = new THREE.Box3().setFromObject(this.entity.transform);
    }
    
    update(deltaTime) {
        if (this.isKinematic) return;
        
        // Apply gravity
        if (this.useGravity) {
            const gravity = this.entity.engine.config?.physics?.gravity || -9.8;
            this.velocity.y += gravity * deltaTime;
        }
        
        // Update position based on velocity
        this.entity.transform.position.x += this.velocity.x * deltaTime;
        this.entity.transform.position.y += this.velocity.y * deltaTime;
        this.entity.transform.position.z += this.velocity.z * deltaTime;
        
        // Simple floor collision
        if (this.entity.transform.position.y < 0) {
            this.entity.transform.position.y = 0;
            this.velocity.y = -this.velocity.y * this.bounciness;
        }
        
        // Update bounding box
        this.boundingBox.setFromObject(this.entity.transform);
        
        // Update serialized properties
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