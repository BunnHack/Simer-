import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export class AssetSystem {
    constructor(engine) {
        this.engine = engine;
        this.assets = new Map();
        this.loaders = {
            texture: new THREE.TextureLoader(),
            gltf: new GLTFLoader(),
            obj: new OBJLoader(),
            fbx: new FBXLoader(),
            audio: {
                load: (url, onLoad, onProgress, onError) => {
                    const audio = new Audio(url);
                    audio.addEventListener('canplaythrough', () => onLoad(audio));
                    audio.addEventListener('error', onError);
                    audio.load();
                    return audio;
                }
            }
        };
    }
    
    /**
     * Load an asset from a URL
     * @param {string} url - URL of the asset to load
     * @param {string} type - Type of asset (texture, model, audio)
     * @param {object} options - Additional loading options
     * @returns {Promise} - Promise that resolves with the loaded asset
     */
    load(url, type, options = {}) {
        // Return cached asset if already loaded
        const cacheKey = url + '|' + type;
        if (this.assets.has(cacheKey)) {
            return Promise.resolve(this.assets.get(cacheKey));
        }
        
        return new Promise((resolve, reject) => {
            const handleLoad = (asset) => {
                this.assets.set(cacheKey, asset);
                resolve(asset);
                
                // Dispatch event when asset is loaded
                this.engine.events.emit('asset:loaded', {
                    url,
                    type,
                    asset
                });
            };
            
            const handleProgress = (event) => {
                if (options.onProgress) {
                    options.onProgress(event);
                }
            };
            
            const handleError = (error) => {
                console.error(`Error loading ${type} from ${url}:`, error);
                reject(error);
            };
            
            switch (type) {
                case 'texture':
                    this.loaders.texture.load(url, handleLoad, handleProgress, handleError);
                    break;
                    
                case 'gltf':
                case 'glb':
                    this.loaders.gltf.load(url, handleLoad, handleProgress, handleError);
                    break;
                    
                case 'obj':
                    this.loaders.obj.load(url, handleLoad, handleProgress, handleError);
                    break;
                    
                case 'fbx':
                    this.loaders.fbx.load(url, handleLoad, handleProgress, handleError);
                    break;
                    
                case 'audio':
                    this.loaders.audio.load(url, handleLoad, handleProgress, handleError);
                    break;
                    
                default:
                    reject(new Error(`Unsupported asset type: ${type}`));
            }
        });
    }
    
    /**
     * Get a previously loaded asset
     * @param {string} url - URL of the asset
     * @param {string} type - Type of the asset
     * @returns {any} - The loaded asset or null if not found
     */
    get(url, type) {
        const cacheKey = url + '|' + type;
        return this.assets.get(cacheKey) || null;
    }
    
    /**
     * Check if an asset is loaded
     * @param {string} url - URL of the asset
     * @param {string} type - Type of the asset
     * @returns {boolean} - True if the asset is loaded
     */
    isLoaded(url, type) {
        const cacheKey = url + '|' + type;
        return this.assets.has(cacheKey);
    }
    
    /**
     * Unload an asset, removing it from the cache
     * @param {string} url - URL of the asset
     * @param {string} type - Type of the asset
     */
    unload(url, type) {
        const cacheKey = url + '|' + type;
        if (this.assets.has(cacheKey)) {
            const asset = this.assets.get(cacheKey);
            
            // Dispose of Three.js resources properly
            if (asset.dispose && typeof asset.dispose === 'function') {
                asset.dispose();
            }
            
            this.assets.delete(cacheKey);
        }
    }
    
    /**
     * Create a material from a texture
     * @param {string} textureUrl - URL of the texture
     * @param {string} materialType - Type of material to create
     * @param {object} properties - Additional material properties
     * @returns {Promise<THREE.Material>} - The created material
     */
    createMaterialFromTexture(textureUrl, materialType = 'standard', properties = {}) {
        return this.load(textureUrl, 'texture')
            .then(texture => {
                const materialTypes = {
                    'basic': THREE.MeshBasicMaterial,
                    'standard': THREE.MeshStandardMaterial,
                    'phong': THREE.MeshPhongMaterial,
                    'lambert': THREE.MeshLambertMaterial
                };
                
                const MaterialClass = materialTypes[materialType] || THREE.MeshStandardMaterial;
                return new MaterialClass({
                    map: texture,
                    ...properties
                });
            });
    }
}