/**
 * Main GameEngine class for the Three.js Game Engine
 * Manages the core functionality of the engine including rendering, physics, 
 * object management, and systems coordination.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config } from './config.js';
import { InputSystem } from './inputSystem.js';
import { EventSystem } from './eventSystem.js';
import { AssetSystem } from './assetSystem.js';
import { ScriptingSystem } from './scriptingSystem.js';
import { ECSManager, TransformComponent, RenderComponent, PhysicsComponent } from './ecs.js';
import { ShaderSystem } from './shaderSystem.js';
import { MaterialSystem } from './materialSystem.js';

class GameEngine {
    /**
     * Creates a new GameEngine instance
     * Initializes the scene, renderer, camera, and all subsystems
     */
    constructor() {
        this.scene = new THREE.Scene();
        this.objects = [];
        this.selectedObject = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.clock = new THREE.Clock();
        this.deltaTime = 0;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        
        // Object selection tools
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredObject = null;
        this.selectionOutlinePass = null;
        this.hoverOutlinePass = null;
        
        // Initialize input system
        this.input = new InputSystem(this);
        
        // Initialize global event system
        this.events = new EventSystem();
        
        // Initialize asset system
        this.assets = new AssetSystem(this);
        
        // Initialize shader system
        this.shaderSystem = new ShaderSystem(this);
        
        // Initialize material system
        this.materialSystem = new MaterialSystem(this);
        
        // Initialize scripting system
        this.scriptingSystem = new ScriptingSystem(this);
        
        // Initialize entity-component system
        this.ecs = new ECSManager(this);

        // Register built-in components with dependency information
        this.ecs.registerComponent(TransformComponent);
        this.ecs.registerComponent(RenderComponent);
        this.ecs.registerComponent(PhysicsComponent); // Now has dependency on TransformComponent
        
        // Initialize renderer
        this.initRenderer();
        
        // Initialize camera
        this.initCamera();
        
        // Initialize controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        
        // Initialize basic scene elements
        this.initSceneElements();
        
        // Post-processing composer for advanced rendering
        this.initPostProcessing();
        
        // Start update loop
        this.update();
    }
    
    /**
     * Initializes the WebGL renderer with configured settings
     * Sets up the viewport and event listeners
     */
    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: config.renderer.antialias 
        });
        this.renderer.setSize(window.innerWidth - 600, window.innerHeight); 
        this.renderer.setClearColor(config.renderer.clearColor);
        this.renderer.shadowMap.enabled = config.renderer.shadowMap;
        
        // Add renderer to DOM
        const viewportElement = document.getElementById('viewport');
        viewportElement.appendChild(this.renderer.domElement);
        
        // Remove welcome banner
        const welcomeBanner = document.querySelector('.welcome-banner');
        if (welcomeBanner) {
            welcomeBanner.remove();
        }
        
        // Add mouse event listeners for selection
        viewportElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        viewportElement.addEventListener('click', this.onMouseClick.bind(this));
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    /**
     * Initializes the camera with proper aspect ratio and positioning
     */
    initCamera() {
        const aspect = (window.innerWidth - 600) / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(
            config.camera.fov,
            aspect,
            config.camera.near,
            config.camera.far
        );
        this.camera.position.set(
            config.camera.position.x,
            config.camera.position.y,
            config.camera.position.z
        );
        this.camera.lookAt(0, 0, 0);
    }
    
    initSceneElements() {
        // Add grid helper
        this.grid = new THREE.GridHelper(
            config.editor.gridSize, 
            config.editor.gridDivisions
        );
        this.scene.add(this.grid);
        
        // Add axes helper
        if (config.editor.showAxesHelper) {
            this.axesHelper = new THREE.AxesHelper(2);
            this.scene.add(this.axesHelper);
        }
        
        // Add ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // Add default directional light
        const directionalLight = new THREE.DirectionalLight(
            config.defaultLight.color, 
            config.defaultLight.intensity
        );
        directionalLight.position.set(
            config.defaultLight.position.x,
            config.defaultLight.position.y,
            config.defaultLight.position.z
        );
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        this.objects.push({
            id: 'directional-light-1',
            name: 'Directional Light',
            type: 'light',
            object3D: directionalLight,
            children: [],
            parent: null
        });
    }
    
    initPostProcessing() {
        // Create a basic outline pass for selection and hover
        if (typeof THREE.OutlinePass !== 'undefined') {
            this.composer = new THREE.EffectComposer(this.renderer);
            const renderPass = new THREE.RenderPass(this.scene, this.camera);
            this.composer.addPass(renderPass);
            
            // Create outline pass for selected object
            this.selectionOutlinePass = new THREE.OutlinePass(
                new THREE.Vector2(window.innerWidth - 600, window.innerHeight), 
                this.scene, 
                this.camera
            );
            this.selectionOutlinePass.edgeStrength = 3;
            this.selectionOutlinePass.edgeGlow = 1;
            this.selectionOutlinePass.edgeThickness = 1;
            this.selectionOutlinePass.visibleEdgeColor.set('#4b80ff');
            this.selectionOutlinePass.hiddenEdgeColor.set('#4b80ff');
            this.composer.addPass(this.selectionOutlinePass);
            
            // Create outline pass for hovered object
            this.hoverOutlinePass = new THREE.OutlinePass(
                new THREE.Vector2(window.innerWidth - 600, window.innerHeight), 
                this.scene, 
                this.camera
            );
            this.hoverOutlinePass.edgeStrength = 2;
            this.hoverOutlinePass.edgeGlow = 0.5;
            this.hoverOutlinePass.edgeThickness = 1;
            this.hoverOutlinePass.visibleEdgeColor.set('#ffffff');
            this.hoverOutlinePass.hiddenEdgeColor.set('#ffffff');
            this.composer.addPass(this.hoverOutlinePass);
        } else {
            this.composer = null;
        }
    }
    
    handleResize() {
        const width = window.innerWidth - 600; 
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    onMouseMove(event) {
        if (this.isPlaying) return; // Don't allow selection in play mode
        
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update the raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Find intersections with selectable objects
        const selectableObjects = this.objects
            .filter(obj => obj.type !== 'light') // Exclude lights or other non-selectable objects
            .map(obj => obj.object3D);
            
        const intersects = this.raycaster.intersectObjects(selectableObjects, false);
        
        // Update hover object
        if (intersects.length > 0) {
            const hoveredThreeObject = intersects[0].object;
            this.hoveredObject = this.getObjectByThreeJsObject(hoveredThreeObject);
            
            // Update hover outline
            if (this.hoverOutlinePass && this.hoveredObject) {
                this.hoverOutlinePass.selectedObjects = [this.hoveredObject.object3D];
                document.body.style.cursor = 'pointer';
            }
        } else {
            this.hoveredObject = null;
            if (this.hoverOutlinePass) {
                this.hoverOutlinePass.selectedObjects = [];
                document.body.style.cursor = 'default';
            }
        }
    }
    
    onMouseClick(event) {
        if (this.isPlaying) return; // Don't allow selection in play mode
        
        if (this.hoveredObject) {
            this.selectObject(this.hoveredObject);
        } else {
            this.selectObject(null); // Deselect if clicked on nothing
        }
    }
    
    pauseGame() {
        if (!this.isPlaying) return;
        
        this.isPaused = !this.isPaused;
        
        // Update UI
        const statusElement = document.getElementById('engine-status');
        const pauseButton = document.getElementById('main-pause');
        
        if (this.isPaused) {
            statusElement.textContent = 'Status: Paused';
            pauseButton.textContent = 'Resume';
            this.clock.stop(); // Stop the clock to pause time
        } else {
            statusElement.textContent = 'Status: Play Mode';
            pauseButton.textContent = 'Pause';
            this.clock.start(); // Restart the clock
        }
    }
    
    update() {
        requestAnimationFrame(() => this.update());
        
        // Update controls
        this.controls.update();
        
        // Calculate delta time and FPS
        this.deltaTime = this.clock.getDelta();
        this.frameCount++;
        
        // Update FPS counter every second
        if (this.clock.elapsedTime - this.lastFpsUpdate >= 1.0) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = this.clock.elapsedTime;
            document.getElementById('fps').textContent = `FPS: ${this.fps}`;
        }
        
        // Update input system
        this.input.update();
        
        // Update physics and game logic if in play mode and not paused
        if (this.isPlaying && !this.isPaused) {
            // Process any queued events
            this.events.processQueue();
            
            // Update shader animations
            if (this.shaderSystem) {
                this.shaderSystem.update(this.deltaTime);
            }
            
            this.updatePhysics();
        }
        
        // Reset input states at end of frame
        this.input.resetFrame();
        
        // Render scene
        if (this.composer && this.composer.passes.length > 0) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    /**
     * Updates the physics simulation
     * Handles object movement, collisions, and applies physics forces
     */
    updatePhysics() {
        // Simple physics update placeholder
        // In a real engine, this would handle collisions, forces, etc.
        this.objects.forEach(obj => {
            if (obj.physics && obj.physics.enabled) {
                // Apply gravity
                obj.physics.velocity.y += config.physics.gravity * this.deltaTime;
                
                // Update position
                obj.object3D.position.x += obj.physics.velocity.x * this.deltaTime;
                obj.object3D.position.y += obj.physics.velocity.y * this.deltaTime;
                obj.object3D.position.z += obj.physics.velocity.z * this.deltaTime;
                
                // Floor collision
                if (obj.object3D.position.y < obj.physics.boundingBox.min.y) {
                    obj.object3D.position.y = obj.physics.boundingBox.min.y;
                    obj.physics.velocity.y = -obj.physics.velocity.y * obj.physics.bounciness;
                }
            }
        });
        
        // Update scripts (moved to ScriptingSystem)
        this.scriptingSystem.updateScripts(this.deltaTime);
        
        // Update ECS
        this.ecs.updateEntities(this.deltaTime);
        this.ecs.lateUpdateEntities(this.deltaTime);
    }
    
    /**
     * Toggles between play and edit modes
     * Initializes physics, scripts, and ECS when entering play mode
     * Cleans up resources when exiting play mode
     */
    togglePlayMode() {
        this.isPlaying = !this.isPlaying;
        
        // Update UI
        const statusElement = document.getElementById('engine-status');
        const playButton = document.getElementById('play-pause');
        
        if (this.isPlaying) {
            statusElement.textContent = 'Status: Play Mode';
            playButton.textContent = '■ Stop';
            
            // Hide editor-only elements
            this.grid.visible = false;
            if (this.axesHelper) this.axesHelper.visible = false;
            
            // Initialize physics for objects that need it
            this.objects.forEach(obj => {
                if (obj.type === 'cube' || obj.type === 'sphere') {
                    obj.physics = {
                        enabled: true,
                        velocity: new THREE.Vector3(0, 0, 0),
                        bounciness: 0.7,
                        boundingBox: new THREE.Box3().setFromObject(obj.object3D)
                    };
                    
                    // Also create entity and components if ECS is enabled
                    const entity = this.ecs.createEntity(obj);
                    entity.addComponent(TransformComponent);
                    entity.addComponent(RenderComponent);
                    entity.addComponent(PhysicsComponent);
                }
            });
            
            // Initialize scripts
            this.scriptingSystem.initializeScripts();
            
            // Initialize ECS with dependency ordering
            this.ecs.initializeEntities();
        } else {
            statusElement.textContent = 'Status: Editor Mode';
            playButton.textContent = '▶ Play';
            
            // Show editor elements again
            this.grid.visible = true;
            if (this.axesHelper) this.axesHelper.visible = true;
            
            // Clean up physics and script instances
            this.objects.forEach(obj => {
                if (obj.physics) {
                    obj.physics.enabled = false;
                }
            });
            
            // Clean up scripts
            this.scriptingSystem.cleanupScripts();
            
            // Also terminate any web workers
            this.ecs.terminateAllWorkers();
            
            // Clear ECS
            this.ecs.clear();
        }
    }
    
    savePrefab(obj, name) {
        if (!this.prefabs) this.prefabs = {};
        
        // Clone the object definition but strip instance-specific data
        const prefab = {
            name: name || obj.name,
            type: obj.type,
            script: obj.script,
            position: {x: obj.object3D.position.x, y: obj.object3D.position.y, z: obj.object3D.position.z},
            rotation: {x: obj.object3D.rotation.x, y: obj.object3D.rotation.y, z: obj.object3D.rotation.z},
            scale: {x: obj.object3D.scale.x, y: obj.object3D.scale.y, z: obj.object3D.scale.z}
        };
        
        // Store material properties if applicable
        if (obj.object3D.material) {
            prefab.material = {
                color: '#' + obj.object3D.material.color.getHexString(),
                wireframe: obj.object3D.material.wireframe,
                transparent: obj.object3D.material.transparent,
                opacity: obj.object3D.material.opacity,
                metalness: obj.object3D.material.metalness,
                roughness: obj.object3D.material.roughness
            };
        }
        
        this.prefabs[name] = prefab;
        return prefab;
    }
    
    instantiatePrefab(prefabName, position, rotation) {
        if (!this.prefabs || !this.prefabs[prefabName]) {
            console.error(`Prefab "${prefabName}" not found`);
            return null;
        }
        
        const prefab = this.prefabs[prefabName];
        let newObj;
        
        // Create object based on type
        if (prefab.type === 'cube') {
            newObj = this.addCube();
        } else if (prefab.type === 'sphere') {
            newObj = this.addSphere();
        } else if (prefab.type === 'light') {
            newObj = this.addLight();
        } else {
            console.error(`Unknown prefab type: ${prefab.type}`);
            return null;
        }
        
        // Apply prefab properties
        newObj.name = prefab.name;
        newObj.script = prefab.script;
        
        // Apply transform
        if (position) {
            newObj.object3D.position.set(position.x, position.y, position.z);
        } else {
            newObj.object3D.position.set(prefab.position.x, prefab.position.y, prefab.position.z);
        }
        
        if (rotation) {
            newObj.object3D.rotation.set(rotation.x, rotation.y, rotation.z);
        } else {
            newObj.object3D.rotation.set(prefab.rotation.x, prefab.rotation.y, prefab.rotation.z);
        }
        
        newObj.object3D.scale.set(prefab.scale.x, prefab.scale.y, prefab.scale.z);
        
        // Apply material properties if they exist
        if (prefab.material && newObj.object3D.material) {
            newObj.object3D.material.color.set(prefab.material.color);
            newObj.object3D.material.wireframe = prefab.material.wireframe;
            newObj.object3D.material.transparent = prefab.material.transparent;
            newObj.object3D.material.opacity = prefab.material.opacity;
            newObj.object3D.material.metalness = prefab.material.metalness;
            newObj.object3D.material.roughness = prefab.material.roughness;
        }
        
        return newObj;
    }
    
    addCube() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ 
            color: config.editor.defaultObjectColor 
        });
        const cube = new THREE.Mesh(geometry, material);
        cube.castShadow = true;
        cube.receiveShadow = true;
        
        // Position slightly above the grid
        cube.position.y = 0.5;
        
        // Add to scene
        this.scene.add(cube);
        
        // Create object metadata
        const cubeObj = {
            id: `cube-${this.objects.length + 1}`,
            name: `Cube ${this.objects.length + 1}`,
            type: 'cube',
            object3D: cube,
            children: [],
            parent: null
        };
        
        this.objects.push(cubeObj);
        this.selectObject(cubeObj);
        
        // Update object count
        document.getElementById('object-count').textContent = `Objects: ${this.objects.length}`;
        
        return cubeObj;
    }
    
    addSphere() {
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshStandardMaterial({ 
            color: config.editor.defaultObjectColor 
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        
        // Position slightly above the grid
        sphere.position.y = 0.5;
        
        // Add to scene
        this.scene.add(sphere);
        
        // Create object metadata
        const sphereObj = {
            id: `sphere-${this.objects.length + 1}`,
            name: `Sphere ${this.objects.length + 1}`,
            type: 'sphere',
            object3D: sphere,
            children: [],
            parent: null
        };
        
        this.objects.push(sphereObj);
        this.selectObject(sphereObj);
        
        // Update object count
        document.getElementById('object-count').textContent = `Objects: ${this.objects.length}`;
        
        return sphereObj;
    }
    
    addLight() {
        const light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(0, 3, 0);
        light.castShadow = true;
        
        // Add helper sphere to visualize the light
        const sphereSize = 0.2;
        const geometry = new THREE.SphereGeometry(sphereSize, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const lightSphere = new THREE.Mesh(geometry, material);
        light.add(lightSphere);
        
        // Add to scene
        this.scene.add(light);
        
        // Create object metadata
        const lightObj = {
            id: `light-${this.objects.length + 1}`,
            name: `Point Light ${this.objects.length + 1}`,
            type: 'light',
            object3D: light,
            children: [],
            parent: null
        };
        
        this.objects.push(lightObj);
        this.selectObject(lightObj);
        
        // Update object count
        document.getElementById('object-count').textContent = `Objects: ${this.objects.length}`;
        
        return lightObj;
    }
    
    setParent(child, parent) {
        if (!child || !parent) return false;
        
        // Remove from previous parent's children array if it had one
        if (child.parent) {
            const prevParent = this.getObjectById(child.parent);
            if (prevParent) {
                const index = prevParent.children.indexOf(child.id);
                if (index > -1) {
                    prevParent.children.splice(index, 1);
                }
            }
            
            // Remove from scene if it was a top-level object
            this.scene.remove(child.object3D);
        }
        
        // Set the new parent
        child.parent = parent.id;
        
        // Add to new parent's children array
        if (!parent.children.includes(child.id)) {
            parent.children.push(child.id);
        }
        
        // Update Three.js object hierarchy
        parent.object3D.add(child.object3D);
        
        return true;
    }
    
    removeFromParent(child) {
        if (!child || !child.parent) return false;
        
        const parent = this.getObjectById(child.parent);
        if (parent) {
            // Remove from parent's children array
            const index = parent.children.indexOf(child.id);
            if (index > -1) {
                parent.children.splice(index, 1);
            }
            
            // Update Three.js object hierarchy
            parent.object3D.remove(child.object3D);
            
            // Reset parent reference
            child.parent = null;
            
            // Add back to scene as top-level object
            this.scene.add(child.object3D);
            
            return true;
        }
        
        return false;
    }
    
    getChildrenRecursive(parent) {
        if (!parent || !parent.children) return [];
        
        let allChildren = [];
        for (const childId of parent.children) {
            const child = this.getObjectById(childId);
            if (child) {
                allChildren.push(child);
                allChildren = allChildren.concat(this.getChildrenRecursive(child));
            }
        }
        
        return allChildren;
    }
    
    selectObject(obj) {
        // Clear previous selection
        if (this.selectedObject) {
            // Remove any selection visual indicators
        }
        
        this.selectedObject = obj;
        
        // Update selection outline
        if (this.selectionOutlinePass) {
            this.selectionOutlinePass.selectedObjects = obj ? [obj.object3D] : [];
        }
        
        // Dispatch selection change event
        const event = new CustomEvent('object-selected', { 
            detail: { object: obj } 
        });
        document.dispatchEvent(event);
    }
    
    getObjectById(id) {
        return this.objects.find(obj => obj.id === id);
    }
    
    removeObject(obj) {
        const index = this.objects.indexOf(obj);
        if (index > -1) {
            // Clean up any child references
            if (obj.children && obj.children.length > 0) {
                // Clone the array since we'll be modifying it
                const childrenIds = [...obj.children];
                for (const childId of childrenIds) {
                    const child = this.getObjectById(childId);
                    if (child) {
                        this.removeObject(child);
                    }
                }
            }
            
            // Remove from parent's children array if it has a parent
            if (obj.parent) {
                const parent = this.getObjectById(obj.parent);
                if (parent && parent.children) {
                    const childIndex = parent.children.indexOf(obj.id);
                    if (childIndex > -1) {
                        parent.children.splice(childIndex, 1);
                    }
                }
            }
            
            // Mark for cleanup in scripting system
            if (this.scriptingSystem) {
                this.scriptingSystem.markForCleanup(obj);
            }
            
            // Remove from scene
            this.scene.remove(obj.object3D);
            this.objects.splice(index, 1);
            
            // Update object count
            document.getElementById('object-count').textContent = `Objects: ${this.objects.length}`;
            
            // If the removed object was selected, clear selection
            if (this.selectedObject === obj) {
                this.selectedObject = null;
                const event = new CustomEvent('object-selected', { 
                    detail: { object: null } 
                });
                document.dispatchEvent(event);
            }
        }
    }
    
    saveScene() {
        const sceneData = {
            objects: this.objects.map(obj => this.serializeObject(obj)),
            properties: {}
        };
        
        // Save serialized script properties
        if (this.scriptingSystem) {
            sceneData.properties.scripts = this.scriptingSystem.serializeAllScriptProperties();
        }
        
        return sceneData;
    }
    
    loadScene(sceneData) {
        if (!sceneData || !sceneData.objects) {
            console.error("Invalid scene data");
            return false;
        }
        
        // Clear current scene
        while (this.objects.length > 0) {
            this.removeObject(this.objects[0]);
        }
        
        // Load objects
        const objectMap = new Map(); // Track old ID to new object mapping
        
        // First pass: create all objects
        for (const objData of sceneData.objects) {
            const newObj = this.deserializeObject(objData);
            if (newObj) {
                objectMap.set(objData.id, newObj);
            }
        }
        
        // Second pass: reconstruct hierarchy
        for (const objData of sceneData.objects) {
            if (objData.parent && objectMap.has(objData.id) && objectMap.has(objData.parent)) {
                const child = objectMap.get(objData.id);
                const parent = objectMap.get(objData.parent);
                this.setParent(child, parent);
            }
        }
        
        // Restore script properties if any
        if (sceneData.properties && sceneData.properties.scripts && this.scriptingSystem) {
            this.scriptingSystem.deserializeAllScriptProperties(sceneData.properties.scripts);
        }
        
        return true;
    }
    
    serializeObject(obj) {
        const serialized = {
            id: obj.id,
            name: obj.name,
            type: obj.type,
            parent: obj.parent,
            children: obj.children ? [...obj.children] : [],
            transform: {
                position: {
                    x: obj.object3D.position.x,
                    y: obj.object3D.position.y,
                    z: obj.object3D.position.z
                },
                rotation: {
                    x: obj.object3D.rotation.x,
                    y: obj.object3D.rotation.y,
                    z: obj.object3D.rotation.z
                },
                scale: {
                    x: obj.object3D.scale.x,
                    y: obj.object3D.scale.y,
                    z: obj.object3D.scale.z
                }
            }
        };
        
        // Serialize material if present
        if (obj.object3D.material) {
            serialized.material = {
                color: '#' + obj.object3D.material.color.getHexString(),
                wireframe: obj.object3D.material.wireframe,
                transparent: obj.object3D.material.transparent,
                opacity: obj.object3D.material.opacity,
                metalness: obj.object3D.material.metalness,
                roughness: obj.object3D.material.roughness
            };
        }
        
        // Save script
        if (obj.script) {
            serialized.script = obj.script;
        }
        
        // Save tags
        if (obj.tags) {
            serialized.tags = Array.from(obj.tags);
        }
        
        return serialized;
    }
    
    deserializeObject(data) {
        let newObj;
        
        // Create object based on type
        switch (data.type) {
            case 'cube':
                newObj = this.addCube();
                break;
            case 'sphere':
                newObj = this.addSphere();
                break;
            case 'light':
                newObj = this.addLight();
                break;
            default:
                console.error(`Unknown object type: ${data.type}`);
                return null;
        }
        
        // Apply properties
        newObj.name = data.name;
        
        // Apply transform
        newObj.object3D.position.set(
            data.transform.position.x,
            data.transform.position.y,
            data.transform.position.z
        );
        
        newObj.object3D.rotation.set(
            data.transform.rotation.x,
            data.transform.rotation.y,
            data.transform.rotation.z
        );
        
        newObj.object3D.scale.set(
            data.transform.scale.x,
            data.transform.scale.y,
            data.transform.scale.z
        );
        
        // Apply material if present
        if (data.material && newObj.object3D.material) {
            newObj.object3D.material.color.set(data.material.color);
            newObj.object3D.material.wireframe = data.material.wireframe;
            newObj.object3D.material.transparent = data.material.transparent;
            newObj.object3D.material.opacity = data.material.opacity;
            
            if (data.material.metalness !== undefined) {
                newObj.object3D.material.metalness = data.material.metalness;
            }
            
            if (data.material.roughness !== undefined) {
                newObj.object3D.material.roughness = data.material.roughness;
            }
        }
        
        // Restore script
        if (data.script) {
            newObj.script = data.script;
        }
        
        // Restore tags
        if (data.tags && data.tags.length > 0) {
            for (const tag of data.tags) {
                this.scriptingSystem.addTag(newObj, tag);
            }
        }
        
        return newObj;
    }
    
    getObjectByThreeJsObject(threeObject) {
        return this.objects.find(obj => obj.object3D === threeObject);
    }
}

export default GameEngine;