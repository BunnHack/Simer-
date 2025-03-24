import * as THREE from 'three';

/**
 * MaterialSystem manages creation, management, and presets for materials
 * Provides utilities for creating PBR materials, shared materials, and material libraries
 */
export class MaterialSystem {
    /**
     * Create a new MaterialSystem
     * @param {GameEngine} engine - Reference to the main game engine
     */
    constructor(engine) {
        this.engine = engine;
        this.materials = new Map();
        this.materialPresets = new Map();
        
        // Initialize default material presets
        this.initMaterialPresets();
    }
    
    /**
     * Initialize default material presets
     */
    initMaterialPresets() {
        // PBR material presets
        this.registerMaterialPreset('metal', {
            type: 'standard',
            color: '#8c8c8c',
            metalness: 1.0,
            roughness: 0.2,
            envMapIntensity: 1.0
        });
        
        this.registerMaterialPreset('plastic', {
            type: 'standard',
            color: '#ffffff',
            metalness: 0.0,
            roughness: 0.7,
            clearcoat: 0.5,
            clearcoatRoughness: 0.3
        });
        
        this.registerMaterialPreset('glass', {
            type: 'physical',
            color: '#ffffff',
            metalness: 0.0,
            roughness: 0.1,
            transmission: 0.9,
            ior: 1.5,
            transparent: true,
            opacity: 0.5
        });
        
        this.registerMaterialPreset('wood', {
            type: 'standard',
            color: '#a06235',
            metalness: 0.0,
            roughness: 0.8,
            map: { type: 'wood' }
        });
        
        this.registerMaterialPreset('clay', {
            type: 'toon',
            color: '#f5d1b8',
            gradientMap: { type: 'toon' }
        });
        
        this.registerMaterialPreset('emissive', {
            type: 'standard',
            color: '#ffffff',
            emissive: '#ffffff',
            emissiveIntensity: 1.0,
            metalness: 0.0,
            roughness: 1.0
        });
        
        this.registerMaterialPreset('water', {
            type: 'physical',
            color: '#2389da',
            metalness: 0.0,
            roughness: 0.1,
            transmission: 0.9,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        this.registerMaterialPreset('matcap', {
            type: 'matcap',
            color: '#ffffff',
            matcap: { type: 'matcap' }
        });
    }
    
    /**
     * Register a material preset for later use
     * @param {string} name - Name to register the preset under
     * @param {Object} preset - Material preset configuration
     */
    registerMaterialPreset(name, preset) {
        this.materialPresets.set(name, preset);
    }
    
    /**
     * Create a material from a registered preset
     * @param {string} presetName - Name of the material preset
     * @param {Object} overrides - Properties to override in the preset
     * @returns {THREE.Material} The created material
     */
    createMaterialFromPreset(presetName, overrides = {}) {
        const preset = this.materialPresets.get(presetName);
        if (!preset) {
            console.error(`Material preset "${presetName}" not found`);
            return new THREE.MeshStandardMaterial(); // Return default material
        }
        
        // Merge preset with overrides
        const config = { ...preset, ...overrides };
        
        return this.createMaterial(config.type, config);
    }
    
    /**
     * Create a material with specified parameters
     * @param {string} type - Type of material (standard, physical, basic, phong, toon, etc.)
     * @param {Object} parameters - Material parameters
     * @returns {THREE.Material} The created material
     */
    createMaterial(type = 'standard', parameters = {}) {
        let material;
        
        // Extract parameters that aren't directly passed to the THREE.js constructor
        const { map, normalMap, roughnessMap, metalnessMap, emissiveMap, aoMap, ...params } = parameters;
        
        // Create the material based on type
        switch (type.toLowerCase()) {
            case 'standard':
                material = new THREE.MeshStandardMaterial(params);
                break;
                
            case 'physical':
                material = new THREE.MeshPhysicalMaterial(params);
                break;
                
            case 'basic':
                material = new THREE.MeshBasicMaterial(params);
                break;
                
            case 'phong':
                material = new THREE.MeshPhongMaterial(params);
                break;
                
            case 'lambert':
                material = new THREE.MeshLambertMaterial(params);
                break;
                
            case 'toon':
                material = new THREE.MeshToonMaterial(params);
                break;
                
            case 'normal':
                material = new THREE.MeshNormalMaterial(params);
                break;
                
            case 'depth':
                material = new THREE.MeshDepthMaterial(params);
                break;
                
            case 'matcap':
                material = new THREE.MeshMatcapMaterial(params);
                break;
                
            default:
                console.warn(`Unknown material type: ${type}, using MeshStandardMaterial instead`);
                material = new THREE.MeshStandardMaterial(params);
        }
        
        // Load textures if specified
        this.loadTexturesForMaterial(material, {
            map,
            normalMap,
            roughnessMap,
            metalnessMap,
            emissiveMap,
            aoMap
        });
        
        // Generate a unique ID for this material
        const materialId = `material-${this.materials.size}`;
        
        // Store in materials map
        this.materials.set(materialId, material);
        
        // Store the original parameters for serialization
        material.userData.originalParams = { type, ...parameters };
        material.userData.id = materialId;
        
        return material;
    }
    
    /**
     * Load and apply textures to a material
     * @param {THREE.Material} material - The material to apply textures to
     * @param {Object} textures - Object mapping texture types to texture names or configurations
     */
    loadTexturesForMaterial(material, textures) {
        // Process each texture type
        for (const [textureType, textureConfig] of Object.entries(textures)) {
            if (!textureConfig) continue;
            
            let texturePath;
            let textureOptions = {};
            
            // Handle different texture config formats
            if (typeof textureConfig === 'string') {
                texturePath = textureConfig;
            } else if (typeof textureConfig === 'object') {
                if (textureConfig.path) {
                    texturePath = textureConfig.path;
                } else if (textureConfig.type) {
                    // Use a predefined texture type
                    texturePath = this.getDefaultTexturePath(textureConfig.type);
                }
                
                // Extract texture options
                textureOptions = { ...textureConfig };
                delete textureOptions.path;
                delete textureOptions.type;
            }
            
            // Load the texture if we have a path
            if (texturePath) {
                this.engine.assets.load(texturePath, 'texture', textureOptions)
                    .then(texture => {
                        // Apply texture processing options
                        if (textureOptions.repeat) {
                            texture.repeat.set(
                                textureOptions.repeat.x || 1,
                                textureOptions.repeat.y || 1
                            );
                            texture.wrapS = THREE.RepeatWrapping;
                            texture.wrapT = THREE.RepeatWrapping;
                        }
                        
                        if (textureOptions.offset) {
                            texture.offset.set(
                                textureOptions.offset.x || 0,
                                textureOptions.offset.y || 0
                            );
                        }
                        
                        if (textureOptions.rotation) {
                            texture.rotation = textureOptions.rotation;
                        }
                        
                        // Set appropriate encoding for HDR textures
                        if (texturePath.endsWith('.hdr')) {
                            texture.encoding = THREE.RGBEEncoding;
                        }
                        
                        // Apply the texture to the material
                        material[textureType] = texture;
                        
                        // Force material update
                        material.needsUpdate = true;
                    })
                    .catch(error => {
                        console.error(`Error loading texture ${texturePath}:`, error);
                    });
            }
        }
    }
    
    /**
     * Get default texture path for common texture types
     * @param {string} textureType - Type of texture (wood, metal, etc.)
     * @returns {string} Path to the default texture
     */
    getDefaultTexturePath(textureType) {
        // In a real implementation, this would map to actual texture files
        // For now, we'll return placeholder paths
        const textureMappings = {
            wood: 'textures/wood_diffuse.jpg',
            metal: 'textures/metal_diffuse.jpg',
            matcap: 'textures/matcap.jpg',
            toon: 'textures/toon_gradient.jpg',
            brick: 'textures/brick_diffuse.jpg',
            grass: 'textures/grass_diffuse.jpg',
            concrete: 'textures/concrete_diffuse.jpg',
            fabric: 'textures/fabric_diffuse.jpg',
            leather: 'textures/leather_diffuse.jpg',
            marble: 'textures/marble_diffuse.jpg'
        };
        
        return textureMappings[textureType] || 'textures/default.jpg';
    }
    
    /**
     * Serialize a material to JSON
     * @param {THREE.Material} material - Material to serialize
     * @returns {Object} Serialized material data
     */
    serializeMaterial(material) {
        // Start with userData which contains original parameters
        const serialized = { ...material.userData.originalParams };
        
        // Add current material state
        serialized.color = '#' + material.color.getHexString();
        
        // Add other properties based on material type
        if (material.metalness !== undefined) serialized.metalness = material.metalness;
        if (material.roughness !== undefined) serialized.roughness = material.roughness;
        if (material.emissive !== undefined) serialized.emissive = '#' + material.emissive.getHexString();
        if (material.emissiveIntensity !== undefined) serialized.emissiveIntensity = material.emissiveIntensity;
        if (material.transmission !== undefined) serialized.transmission = material.transmission;
        if (material.opacity !== undefined) serialized.opacity = material.opacity;
        if (material.transparent !== undefined) serialized.transparent = material.transparent;
        if (material.wireframe !== undefined) serialized.wireframe = material.wireframe;
        if (material.side !== undefined) serialized.side = material.side;
        
        // Add texture references
        const textureProperties = [
            'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 
            'aoMap', 'envMap', 'lightMap', 'displacementMap'
        ];
        
        for (const prop of textureProperties) {
            if (material[prop]) {
                serialized[prop] = { 
                    path: material[prop].userData.url || 'unknown',
                    repeat: material[prop].repeat ? {
                        x: material[prop].repeat.x,
                        y: material[prop].repeat.y
                    } : undefined,
                    offset: material[prop].offset ? {
                        x: material[prop].offset.x,
                        y: material[prop].offset.y
                    } : undefined,
                    rotation: material[prop].rotation
                };
            }
        }
        
        return serialized;
    }
    
    /**
     * Deserialize a material from JSON
     * @param {Object} data - Serialized material data
     * @returns {THREE.Material} The deserialized material
     */
    deserializeMaterial(data) {
        // Create a material from the serialized data
        return this.createMaterial(data.type || 'standard', data);
    }
    
    /**
     * Create environment map for PBR materials
     * @param {string} path - Path to the environment map (cubemap or equirectangular)
     * @param {boolean} isEquirectangular - Whether the map is equirectangular
     * @returns {THREE.Texture} The created environment map
     */
    createEnvironmentMap(path, isEquirectangular = true) {
        if (isEquirectangular) {
            return new Promise((resolve, reject) => {
                this.engine.assets.load(path, 'texture')
                    .then(texture => {
                        texture.mapping = THREE.EquirectangularReflectionMapping;
                        texture.encoding = THREE.sRGBEncoding;
                        
                        // Set as scene environment map
                        this.engine.scene.environment = texture;
                        
                        // Also set as background if requested
                        if (this.engine.config?.renderer?.useEnvMapAsBackground) {
                            this.engine.scene.background = texture;
                        }
                        
                        resolve(texture);
                    })
                    .catch(reject);
            });
        } else {
            // Regular cubemap loading
            return new Promise((resolve, reject) => {
                const loader = new THREE.CubeTextureLoader();
                
                // Split the path to construct the 6 faces
                const pathParts = path.split('.');
                const extension = pathParts.pop();
                const basePath = pathParts.join('.');
                
                const urls = [
                    `${basePath}_px.${extension}`,
                    `${basePath}_nx.${extension}`,
                    `${basePath}_py.${extension}`,
                    `${basePath}_ny.${extension}`,
                    `${basePath}_pz.${extension}`,
                    `${basePath}_nz.${extension}`
                ];
                
                loader.load(urls, texture => {
                    texture.encoding = THREE.sRGBEncoding;
                    
                    // Set as scene environment map
                    this.engine.scene.environment = texture;
                    
                    // Also set as background if requested
                    if (this.engine.config?.renderer?.useEnvMapAsBackground) {
                        this.engine.scene.background = texture;
                    }
                    
                    resolve(texture);
                }, undefined, reject);
            });
        }
    }
    
    /**
     * Apply a material to an object
     * @param {THREE.Object3D} object - Object to apply material to
     * @param {THREE.Material|string} material - Material or preset name
     */
    applyMaterial(object, material) {
        let mat;
        
        if (typeof material === 'string') {
            // Create from preset
            mat = this.createMaterialFromPreset(material);
        } else if (material instanceof THREE.Material) {
            mat = material;
        } else {
            console.error('Invalid material specification');
            return;
        }
        
        // Apply to object and all children
        object.traverse(child => {
            if (child.isMesh) {
                // Clone the material to avoid sharing between objects
                child.material = mat.clone();
                
                // Ensure the material is updated
                child.material.needsUpdate = true;
            }
        });
    }
    
    /**
     * Create a toon shader material
     * @param {Object} options - Toon shader options
     * @returns {THREE.ShaderMaterial} The created toon shader material
     */
    createToonShaderMaterial(options = {}) {
        // Use ShaderSystem to create the toon shader
        if (!this.engine.shaderSystem) {
            console.error('ShaderSystem not available');
            return new THREE.MeshToonMaterial();
        }
        
        const { 
            color = '#ffffff',
            numShades = 3,
            specular = true,
            rim = true,
            rimColor = '#ffffff',
            rimPower = 2,
            outlineWidth = 0,
            outlineColor = '#000000'
        } = options;
        
        // Create the toon shader
        const toonShader = {
            vertex: `
                uniform float outlineWidth;
                
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragment: `
                uniform vec3 color;
                uniform int numShades;
                uniform bool useSpecular;
                uniform bool useRim;
                uniform vec3 rimColor;
                uniform float rimPower;
                uniform float outlineWidth;
                
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                
                void main() {
                    vec3 normal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    
                    // Basic Lambertian diffuse
                    float diffuse = dot(normal, vec3(0.0, 1.0, 0.0));
                    
                    // Discretize the diffuse for toon shading
                    float step = 1.0 / float(numShades);
                    diffuse = floor(diffuse / step) * step;
                    
                    // Final color
                    vec3 finalColor = color * max(diffuse, 0.2); // Add ambient
                    
                    // Specular highlight (if enabled)
                    if (useSpecular) {
                        vec3 halfVector = normalize(vec3(0.0, 1.0, 0.0) + viewDir);
                        float specular = pow(max(dot(normal, halfVector), 0.0), 32.0);
                        specular = step(0.5, specular);
                        finalColor += specular * 0.5;
                    }
                    
                    // Rim lighting (if enabled)
                    if (useRim) {
                        float rimFactor = pow(1.0 - max(dot(normal, viewDir), 0.0), rimPower);
                        finalColor += rimColor * rimFactor;
                    }
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `
        };
        
        // Create the material
        return this.engine.shaderSystem.createShaderMaterial(toonShader, {
            color: { value: new THREE.Color(color) },
            numShades: { value: numShades },
            useSpecular: { value: specular },
            useRim: { value: rim },
            rimColor: { value: new THREE.Color(rimColor) },
            rimPower: { value: rimPower },
            outlineWidth: { value: outlineWidth },
            outlineColor: { value: new THREE.Color(outlineColor) }
        });
    }
}