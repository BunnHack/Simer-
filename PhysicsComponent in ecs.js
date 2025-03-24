// Update the PhysicsComponent to properly handle THREE import
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
        if (!this.entity?.transform) return;
        
        this.boundingBox = new THREE.Box3();
        this.boundingBox.setFromObject(this.entity.transform);
        
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
        if (!this.enabled || !this.entity?.transform?.position || !this.velocity) return;
        
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