import * as THREE from 'three';

/**
 * ShaderSystem manages creation and updating of custom shaders and materials
 * Provides utilities for creating shader materials, postprocessing effects, and material libraries
 */
export class ShaderSystem {
    /**
     * Create a new ShaderSystem
     * @param {GameEngine} engine - Reference to the main game engine
     */
    constructor(engine) {
        this.engine = engine;
        this.shaderMaterials = new Map();
        this.shaderLibrary = new Map();
        this.postProcessingEffects = new Map();
        
        // Initialize shader chunks library
        this.initShaderChunks();
    }
    
    /**
     * Initialize common shader code chunks that can be reused across shaders
     */
    initShaderChunks() {
        // Common vertex shader chunks
        this.shaderChunks = {
            // Vertex shader chunks
            vertex: {
                // Basic attributes and varying definitions
                common: `
                    varying vec2 vUv;
                    varying vec3 vNormal;
                    varying vec3 vViewPosition;
                `,
                
                // Vertex position transformation with custom displacement
                displacement: `
                    vec3 transformed = position;
                    transformed += normal * displacement;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
                `,
                
                // Fog calculations
                fog: `
                    #ifdef USE_FOG
                        fogDepth = -mvPosition.z;
                    #endif
                `,
                
                // Normal calculation for lighting
                normal: `
                    vNormal = normalize(normalMatrix * normal);
                `,
                
                // Simple vertex shader with UV animation
                uvAnimation: `
                    vUv = uv;
                    vUv.x += time * 0.1;
                    vUv.y += time * 0.05;
                `
            },
            
            // Fragment shader chunks
            fragment: {
                // Common headers for fragment shaders
                common: `
                    uniform vec3 diffuse;
                    uniform float opacity;
                    varying vec2 vUv;
                    varying vec3 vNormal;
                `,
                
                // PBR lighting calculations
                lighting: `
                    vec3 normal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    
                    // Ambient light
                    vec3 ambient = ambientLightColor * diffuse;
                    
                    // Directional lights
                    vec3 directDiffuse = vec3(0.0);
                    vec3 directSpecular = vec3(0.0);
                    
                    #if NUM_DIR_LIGHTS > 0
                    for(int i = 0; i < NUM_DIR_LIGHTS; i++) {
                        vec3 lightDir = directionalLights[i].direction;
                        vec3 lightColor = directionalLights[i].color;
                        
                        float dotNL = dot(normal, lightDir);
                        float diff = max(dotNL, 0.0);
                        
                        directDiffuse += lightColor * diff;
                        
                        // Simple specular reflection
                        vec3 halfwayDir = normalize(lightDir + viewDir);
                        float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);
                        directSpecular += lightColor * spec * 0.2;
                    }
                    #endif
                    
                    gl_FragColor = vec4(ambient + directDiffuse + directSpecular, opacity);
                `,
                
                // Texture sampling
                textureMap: `
                    vec4 texelColor = texture2D(map, vUv);
                    diffuse *= texelColor.rgb;
                    opacity *= texelColor.a;
                `,
                
                // Fog application
                fog: `
                    #ifdef USE_FOG
                        float fogFactor = smoothstep(fogNear, fogFar, fogDepth);
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
                    #endif
                `,
                
                // Simple color output
                color: `
                    gl_FragColor = vec4(diffuse, opacity);
                `
            },
            
            // Complete shader templates
            templates: {
                basic: {
                    vertex: `
                        varying vec2 vUv;
                        
                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragment: `
                        uniform vec3 color;
                        uniform sampler2D map;
                        varying vec2 vUv;
                        
                        void main() {
                            gl_FragColor = texture2D(map, vUv) * vec4(color, 1.0);
                        }
                    `
                },
                
                // Animated wave effect shader
                wave: {
                    vertex: `
                        uniform float time;
                        uniform float amplitude;
                        uniform float frequency;
                        
                        varying vec2 vUv;
                        
                        void main() {
                            vUv = uv;
                            
                            // Calculate wave displacement
                            float displacement = sin(position.x * frequency + time) * 
                                               sin(position.z * frequency + time) * amplitude;
                            
                            vec3 newPosition = position;
                            newPosition.y += displacement;
                            
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                        }
                    `,
                    fragment: `
                        uniform vec3 color;
                        uniform float time;
                        
                        varying vec2 vUv;
                        
                        void main() {
                            // Animated color based on position and time
                            vec3 finalColor = color;
                            finalColor.r *= 0.8 + 0.2 * sin(vUv.x * 10.0 + time);
                            finalColor.g *= 0.8 + 0.2 * sin(vUv.y * 10.0 + time * 0.5);
                            finalColor.b *= 0.8 + 0.2 * sin((vUv.x + vUv.y) * 5.0 + time * 0.7);
                            
                            gl_FragColor = vec4(finalColor, 1.0);
                        }
                    `
                },
                
                // Dissolve effect shader
                dissolve: {
                    vertex: `
                        varying vec2 vUv;
                        
                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragment: `
                        uniform sampler2D map;
                        uniform sampler2D noiseMap;
                        uniform float dissolveAmount;
                        uniform vec3 dissolveColor;
                        uniform float dissolveWidth;
                        
                        varying vec2 vUv;
                        
                        void main() {
                            vec4 texelColor = texture2D(map, vUv);
                            float noise = texture2D(noiseMap, vUv).r;
                            
                            // Dissolve edge calculation
                            float edgeWidth = dissolveWidth;
                            float edgeDist = dissolveAmount - noise;
                            
                            if(edgeDist < 0.0) {
                                // Fully dissolved area
                                discard;
                            } else if(edgeDist < edgeWidth) {
                                // Edge effect - glow
                                float edgeIntensity = 1.0 - (edgeDist / edgeWidth);
                                texelColor.rgb = mix(texelColor.rgb, dissolveColor, edgeIntensity);
                                texelColor.rgb *= 1.0 + edgeIntensity * 2.0; // Brighten edge
                            }
                            
                            gl_FragColor = texelColor;
                        }
                    `
                }
            }
        };
        
        // Register base shaders in library
        this.registerShader('basic', this.shaderChunks.templates.basic);
        this.registerShader('wave', this.shaderChunks.templates.wave);
        this.registerShader('dissolve', this.shaderChunks.templates.dissolve);
    }
    
    /**
     * Register a shader in the library for later use
     * @param {string} name - Name to register the shader under
     * @param {Object} shader - Object containing vertex and fragment shader code
     */
    registerShader(name, shader) {
        this.shaderLibrary.set(name, shader);
    }
    
    /**
     * Create a shader material from registered shader or custom code
     * @param {string|Object} shader - Shader name from library or object with vertex/fragment code
     * @param {Object} uniforms - Uniform values for the shader
     * @param {Object} parameters - Additional material parameters
     * @returns {THREE.ShaderMaterial} The created shader material
     */
    createShaderMaterial(shader, uniforms = {}, parameters = {}) {
        let shaderCode;
        
        // If shader is a string, look it up in the library
        if (typeof shader === 'string') {
            shaderCode = this.shaderLibrary.get(shader);
            if (!shaderCode) {
                console.error(`Shader "${shader}" not found in library`);
                return null;
            }
        } else if (shader.vertex && shader.fragment) {
            // If shader is an object with vertex and fragment properties, use those
            shaderCode = shader;
        } else {
            console.error('Invalid shader specification');
            return null;
        }
        
        // Setup common uniforms if not provided
        const commonUniforms = {
            time: { value: 0 }
        };
        
        // Merge uniforms
        const mergedUniforms = { ...commonUniforms, ...uniforms };
        
        // Create material
        const material = new THREE.ShaderMaterial({
            vertexShader: shaderCode.vertex,
            fragmentShader: shaderCode.fragment,
            uniforms: mergedUniforms,
            ...parameters
        });
        
        // Generate a unique ID for this material
        const materialId = `shader-material-${this.shaderMaterials.size}`;
        
        // Store in materials map for updating
        this.shaderMaterials.set(materialId, material);
        
        return material;
    }
    
    /**
     * Update all shader materials (e.g., advance time uniform)
     * @param {number} deltaTime - Time since last frame
     */
    update(deltaTime) {
        // Update time uniform in all shader materials
        for (const material of this.shaderMaterials.values()) {
            if (material.uniforms && material.uniforms.time) {
                material.uniforms.time.value += deltaTime;
            }
            
            // Call custom update function if present
            if (material.userData && typeof material.userData.update === 'function') {
                material.userData.update(deltaTime);
            }
        }
    }
    
    /**
     * Create a post-processing effect
     * @param {string} effectType - Type of effect to create
     * @param {Object} parameters - Effect parameters
     * @returns {THREE.Pass} The created post-processing pass
     */
    createPostProcessingEffect(effectType, parameters = {}) {
        if (!this.engine.composer) {
            console.error('EffectComposer not initialized');
            return null;
        }
        
        let pass;
        
        switch (effectType) {
            case 'bloom':
                if (typeof THREE.UnrealBloomPass !== 'undefined') {
                    const { strength = 1.5, radius = 0.4, threshold = 0.85 } = parameters;
                    pass = new THREE.UnrealBloomPass(
                        new THREE.Vector2(window.innerWidth, window.innerHeight),
                        strength,
                        radius,
                        threshold
                    );
                } else {
                    console.error('UnrealBloomPass not available. Include THREE.UnrealBloomPass.js');
                    return null;
                }
                break;
                
            case 'film':
                if (typeof THREE.FilmPass !== 'undefined') {
                    const { noiseIntensity = 0.35, scanlinesIntensity = 0.5, scanlinesCount = 256, grayscale = false } = parameters;
                    pass = new THREE.FilmPass(
                        noiseIntensity,
                        scanlinesIntensity,
                        scanlinesCount,
                        grayscale
                    );
                } else {
                    console.error('FilmPass not available. Include THREE.FilmPass.js');
                    return null;
                }
                break;
                
            case 'glitch':
                if (typeof THREE.GlitchPass !== 'undefined') {
                    const { dtSize = 64 } = parameters;
                    pass = new THREE.GlitchPass(dtSize);
                    pass.goWild = parameters.wild || false;
                } else {
                    console.error('GlitchPass not available. Include THREE.GlitchPass.js');
                    return null;
                }
                break;
                
            case 'dot':
                if (typeof THREE.DotScreenPass !== 'undefined') {
                    const { scale = 1, angle = 0.5, center = new THREE.Vector2(0.5, 0.5) } = parameters;
                    pass = new THREE.DotScreenPass(center, angle, scale);
                } else {
                    console.error('DotScreenPass not available. Include THREE.DotScreenPass.js');
                    return null;
                }
                break;
                
            case 'rgb':
                if (typeof THREE.ShaderPass !== 'undefined' && typeof THREE.RGBShiftShader !== 'undefined') {
                    const { amount = 0.005, angle = 0 } = parameters;
                    pass = new THREE.ShaderPass(THREE.RGBShiftShader);
                    pass.uniforms.amount.value = amount;
                    pass.uniforms.angle.value = angle;
                } else {
                    console.error('RGBShiftShader not available. Include THREE.RGBShiftShader.js');
                    return null;
                }
                break;
                
            case 'custom':
                if (typeof THREE.ShaderPass !== 'undefined' && parameters.shader) {
                    pass = new THREE.ShaderPass({
                        uniforms: parameters.uniforms || {},
                        vertexShader: parameters.shader.vertex,
                        fragmentShader: parameters.shader.fragment
                    });
                } else {
                    console.error('Custom shader pass requires shader code');
                    return null;
                }
                break;
                
            default:
                console.error(`Unknown effect type: ${effectType}`);
                return null;
        }
        
        // Add the pass to the composer
        if (pass) {
            this.engine.composer.addPass(pass);
            
            // Store the pass for later reference
            const effectId = `${effectType}-${this.postProcessingEffects.size}`;
            this.postProcessingEffects.set(effectId, pass);
            
            return pass;
        }
        
        return null;
    }
    
    /**
     * Remove a post-processing effect
     * @param {Object|string} effect - The effect object or its ID
     */
    removePostProcessingEffect(effect) {
        if (!this.engine.composer) return;
        
        let pass;
        
        if (typeof effect === 'string') {
            pass = this.postProcessingEffects.get(effect);
            if (!pass) {
                console.error(`Effect "${effect}" not found`);
                return;
            }
        } else {
            pass = effect;
        }
        
        // Remove from composer
        const passes = this.engine.composer.passes;
        const index = passes.indexOf(pass);
        
        if (index !== -1) {
            passes.splice(index, 1);
            
            // Remove from effects map
            for (const [id, p] of this.postProcessingEffects.entries()) {
                if (p === pass) {
                    this.postProcessingEffects.delete(id);
                    break;
                }
            }
        }
    }
    
    /**
     * Create a custom shader from chunks
     * @param {Object} options - Shader creation options
     * @returns {Object} Object with vertex and fragment shader code
     */
    createShaderFromChunks(options) {
        const {
            vertexChunks = ['common'],
            fragmentChunks = ['common', 'color'],
            customVertex = '',
            customFragment = ''
        } = options;
        
        // Build vertex shader
        let vertexShader = '';
        for (const chunk of vertexChunks) {
            if (this.shaderChunks.vertex[chunk]) {
                vertexShader += this.shaderChunks.vertex[chunk] + '\n';
            }
        }
        
        // Add custom vertex code
        vertexShader += customVertex;
        
        // Add main function if not present
        if (!vertexShader.includes('void main()')) {
            vertexShader += `
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `;
        }
        
        // Build fragment shader
        let fragmentShader = '';
        for (const chunk of fragmentChunks) {
            if (this.shaderChunks.fragment[chunk]) {
                fragmentShader += this.shaderChunks.fragment[chunk] + '\n';
            }
        }
        
        // Add custom fragment code
        fragmentShader += customFragment;
        
        // Add main function if not present
        if (!fragmentShader.includes('void main()')) {
            fragmentShader += `
                void main() {
                    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
                }
            `;
        }
        
        return {
            vertex: vertexShader,
            fragment: fragmentShader
        };
    }
}