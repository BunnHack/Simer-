import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Pane } from 'tweakpane';
import * as dat from 'dat.gui';
import { ScriptEditor } from './scriptEditor.js';
import { Component, TransformComponent, RenderComponent, PhysicsComponent } from './ecs.js';

class EngineUI {
    constructor(engine) {
        this.engine = engine;
        this.transformControl = new TransformControls(
            engine.camera, 
            engine.renderer.domElement
        );
        this.transformControl.addEventListener('dragging-changed', (event) => {
            engine.controls.enabled = !event.value;
        });
        engine.scene.add(this.transformControl);
        
        // Initialize script editor
        this.scriptEditor = new ScriptEditor(engine);
        
        // Initialize UI components
        this.initSceneTree();
        this.initInspector();
        this.initToolbar();
        this.initMainToolbar();
        
        // Subscribe to engine events
        this.setupEventListeners();
    }
    
    initSceneTree() {
        this.sceneTreeElement = document.getElementById('scene-tree');
        this.refreshSceneTree();
    }
    
    refreshSceneTree() {
        // Clear existing tree
        this.sceneTreeElement.innerHTML = '';
        
        // Create scene node
        const sceneItem = document.createElement('li');
        sceneItem.classList.add('tree-item');
        sceneItem.textContent = 'Scene';
        sceneItem.addEventListener('click', () => {
            // Deselect any object
            this.engine.selectObject(null);
            this.transformControl.detach();
            this.updateSelection();
        });
        this.sceneTreeElement.appendChild(sceneItem);
        
        // Create child objects
        const objectsList = document.createElement('ul');
        
        // Only get top-level objects (no parent)
        const topLevelObjects = this.engine.objects.filter(obj => !obj.parent);
        this.createTreeItemsRecursive(topLevelObjects, objectsList);
        
        this.sceneTreeElement.appendChild(objectsList);
    }
    
    createTreeItemsRecursive(objects, parentElement) {
        objects.forEach(obj => {
            const objectItem = document.createElement('li');
            objectItem.classList.add('tree-item');
            objectItem.setAttribute('data-id', obj.id);
            
            // Add expand/collapse arrow if has children
            if (obj.children && obj.children.length > 0) {
                const expandArrow = document.createElement('span');
                expandArrow.classList.add('tree-expand-arrow');
                expandArrow.innerHTML = '▶';
                expandArrow.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const childList = objectItem.querySelector('ul');
                    if (childList) {
                        childList.style.display = childList.style.display === 'none' ? 'block' : 'none';
                        expandArrow.innerHTML = childList.style.display === 'none' ? '▶' : '▼';
                    }
                });
                objectItem.appendChild(expandArrow);
            } else {
                // Add spacing for items without children
                const spacer = document.createElement('span');
                spacer.classList.add('tree-item-spacer');
                spacer.innerHTML = '&nbsp;&nbsp;';
                objectItem.appendChild(spacer);
            }
            
            // Add appropriate icon based on type
            const icon = document.createElement('span');
            icon.classList.add('tree-item-icon');
            
            // Use inline SVG for icons
            let iconSvg;
            if (obj.type === 'cube') {
                iconSvg = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="10" height="10" fill="#4b80ff"/></svg>';
            } else if (obj.type === 'sphere') {
                iconSvg = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="5" fill="#4b80ff"/></svg>';
            } else if (obj.type === 'light') {
                iconSvg = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="5" fill="#ffdd55"/></svg>';
            }
            
            icon.innerHTML = iconSvg;
            objectItem.appendChild(icon);
            
            // Add object name
            const nameSpan = document.createElement('span');
            nameSpan.textContent = obj.name;
            objectItem.appendChild(nameSpan);
            
            // Add script indicator if object has a script
            if (obj.script) {
                const scriptIcon = document.createElement('span');
                scriptIcon.classList.add('script-indicator');
                scriptIcon.innerHTML = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M3,3 L13,3 L13,13 L3,13 L3,3 Z M5,5 L11,5 L11,6 L5,6 L5,5 Z M5,8 L11,8 L11,9 L5,9 L5,8 Z M5,11 L9,11 L9,12 L5,12 L5,11 Z" fill="#66cc66"/></svg>';
                scriptIcon.title = 'This object has a script';
                objectItem.appendChild(scriptIcon);
            }
            
            // Add click event
            objectItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.engine.selectObject(obj);
                this.transformControl.attach(obj.object3D);
                this.updateSelection();
            });
            
            // Add context menu for hierarchy operations
            objectItem.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showObjectContextMenu(e, obj);
            });
            
            parentElement.appendChild(objectItem);
            
            // Recursively add children if any
            if (obj.children && obj.children.length > 0) {
                const childrenList = document.createElement('ul');
                childrenList.classList.add('tree-children');
                
                // Get child objects
                const childObjects = obj.children.map(childId => 
                    this.engine.getObjectById(childId)
                ).filter(Boolean);
                
                // Create tree items for children
                this.createTreeItemsRecursive(childObjects, childrenList);
                
                objectItem.appendChild(childrenList);
            }
        });
    }
    
    showObjectContextMenu(event, obj) {
        // Remove any existing context menu
        const existingMenu = document.querySelector('.object-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'object-context-menu';
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;
        
        // Add menu items
        contextMenu.innerHTML = `
            <div class="context-menu-item" id="rename-object">Rename</div>
            <div class="context-menu-item" id="duplicate-object">Duplicate</div>
            <div class="context-menu-item" id="delete-object">Delete</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" id="create-child">Create Child</div>
            <div class="context-menu-item" id="remove-from-parent">Remove from Parent</div>
        `;
        
        document.body.appendChild(contextMenu);
        
        // Add event listeners
        document.getElementById('rename-object').addEventListener('click', () => {
            const newName = prompt('Enter a new name for the object:', obj.name);
            if (newName) {
                obj.name = newName;
                this.refreshSceneTree();
            }
            contextMenu.remove();
        });
        
        document.getElementById('duplicate-object').addEventListener('click', () => {
            // Duplicate functionality
            // To be implemented
            contextMenu.remove();
        });
        
        document.getElementById('delete-object').addEventListener('click', () => {
            this.engine.removeObject(obj);
            this.refreshSceneTree();
            contextMenu.remove();
        });
        
        document.getElementById('create-child').addEventListener('click', () => {
            const childType = prompt('What type of object to create as child? (cube, sphere, light)');
            if (childType) {
                let childObj;
                if (childType.toLowerCase() === 'cube') {
                    childObj = this.engine.addCube();
                } else if (childType.toLowerCase() === 'sphere') {
                    childObj = this.engine.addSphere();
                } else if (childType.toLowerCase() === 'light') {
                    childObj = this.engine.addLight();
                } else {
                    alert('Unknown object type');
                    return;
                }
                
                // Set as child
                this.engine.setParent(childObj, obj);
                this.refreshSceneTree();
            }
            contextMenu.remove();
        });
        
        document.getElementById('remove-from-parent').addEventListener('click', () => {
            if (obj.parent) {
                this.engine.removeFromParent(obj);
                this.refreshSceneTree();
            } else {
                alert('This object has no parent');
            }
            contextMenu.remove();
        });
        
        // Close context menu when clicking elsewhere
        document.addEventListener('click', function closeMenu(e) {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }
    
    initInspector() {
        this.propertiesContainer = document.getElementById('properties-container');
        
        // Create component browser
        const componentBrowserButton = document.createElement('button');
        componentBrowserButton.textContent = 'Component Browser';
        componentBrowserButton.id = 'open-component-browser';
        componentBrowserButton.addEventListener('click', () => {
            if (this.engine.selectedObject) {
                this.openComponentBrowser(this.engine.selectedObject);
            } else {
                alert('Please select an object first');
            }
        });
        
        // Add to main toolbar
        document.getElementById('main-toolbar').querySelector('.section:nth-child(2)').appendChild(componentBrowserButton);
    }
    
    updateInspector(obj) {
        this.propertiesContainer.innerHTML = '';
        
        if (!obj) {
            const noSelection = document.createElement('div');
            noSelection.classList.add('no-selection');
            noSelection.textContent = 'No object selected';
            this.propertiesContainer.appendChild(noSelection);
            return;
        }
        
        // Create Tweakpane for the object
        const pane = new Pane({
            container: this.propertiesContainer
        });
        
        // Basic properties folder
        const basicFolder = pane.addFolder({ title: 'Basic Properties' });
        basicFolder.addInput(obj, 'name').on('change', () => this.refreshSceneTree());
        
        // Transform folder
        const transformFolder = pane.addFolder({ title: 'Transform' });
        
        // Position
        const posFolder = transformFolder.addFolder({ title: 'Position' });
        posFolder.addInput(obj.object3D.position, 'x', { step: 0.1 });
        posFolder.addInput(obj.object3D.position, 'y', { step: 0.1 });
        posFolder.addInput(obj.object3D.position, 'z', { step: 0.1 });
        
        // Rotation (converted to degrees for easier editing)
        const rotFolder = transformFolder.addFolder({ title: 'Rotation' });
        
        // Helper object to convert between radians and degrees
        const rotationHelper = {
            x: THREE.MathUtils.radToDeg(obj.object3D.rotation.x),
            y: THREE.MathUtils.radToDeg(obj.object3D.rotation.y),
            z: THREE.MathUtils.radToDeg(obj.object3D.rotation.z)
        };
        
        rotFolder.addInput(rotationHelper, 'x', { min: 0, max: 360, label: 'x (deg)' }).on('change', (ev) => {
            obj.object3D.rotation.x = THREE.MathUtils.degToRad(ev.value);
        });
        rotFolder.addInput(rotationHelper, 'y', { min: 0, max: 360, label: 'y (deg)' }).on('change', (ev) => {
            obj.object3D.rotation.y = THREE.MathUtils.degToRad(ev.value);
        });
        rotFolder.addInput(rotationHelper, 'z', { min: 0, max: 360, label: 'z (deg)' }).on('change', (ev) => {
            obj.object3D.rotation.z = THREE.MathUtils.degToRad(ev.value);
        });
        
        // Scale
        const scaleFolder = transformFolder.addFolder({ title: 'Scale' });
        scaleFolder.addInput(obj.object3D.scale, 'x', { min: 0.1, step: 0.1 });
        scaleFolder.addInput(obj.object3D.scale, 'y', { min: 0.1, step: 0.1 });
        scaleFolder.addInput(obj.object3D.scale, 'z', { min: 0.1, step: 0.1 });
        
        // Object-specific properties
        if (obj.type === 'cube' || obj.type === 'sphere') {
            const materialFolder = pane.addFolder({ title: 'Material' });
            
            // Color property
            const material = obj.object3D.material;
            const colorHelper = {
                color: '#' + material.color.getHexString()
            };
            
            materialFolder.addInput(colorHelper, 'color').on('change', (ev) => {
                material.color.set(ev.value);
            });
            
            // Material properties
            materialFolder.addInput(material, 'wireframe');
            materialFolder.addInput(material, 'transparent');
            materialFolder.addInput(material, 'opacity', { min: 0, max: 1, step: 0.1 });
            materialFolder.addInput(material, 'metalness', { min: 0, max: 1, step: 0.1 });
            materialFolder.addInput(material, 'roughness', { min: 0, max: 1, step: 0.1 });
        } else if (obj.type === 'light') {
            const lightFolder = pane.addFolder({ title: 'Light Properties' });
            
            // Light color
            const colorHelper = {
                color: '#' + obj.object3D.color.getHexString()
            };
            
            lightFolder.addInput(colorHelper, 'color').on('change', (ev) => {
                obj.object3D.color.set(ev.value);
            });
            
            // Light intensity
            lightFolder.addInput(obj.object3D, 'intensity', { min: 0, max: 2, step: 0.1 });
            
            // Only add these for point lights
            if (obj.object3D.type === 'PointLight') {
                lightFolder.addInput(obj.object3D, 'distance', { min: 0, max: 100, step: 1 });
                lightFolder.addInput(obj.object3D, 'decay', { min: 0, max: 2, step: 0.1 });
            }
        }
        
        // Advanced options
        const advancedFolder = pane.addFolder({ title: 'Advanced' });
        advancedFolder.addButton({ title: 'Delete Object' }).on('click', () => this.deleteSelectedObject());
        
        // Add shadow properties
        if (obj.object3D.castShadow !== undefined) {
            const shadowFolder = advancedFolder.addFolder({ title: 'Shadows' });
            shadowFolder.addInput(obj.object3D, 'castShadow', { label: 'Cast Shadow' });
            shadowFolder.addInput(obj.object3D, 'receiveShadow', { label: 'Receive Shadow' });
        }
    }
    
    initToolbar() {
        // Add cube button
        document.getElementById('add-cube').addEventListener('click', () => {
            this.engine.addCube();
            this.refreshSceneTree();
        });
        
        // Add sphere button
        document.getElementById('add-sphere').addEventListener('click', () => {
            this.engine.addSphere();
            this.refreshSceneTree();
        });
        
        // Add light button
        document.getElementById('add-light').addEventListener('click', () => {
            this.engine.addLight();
            this.refreshSceneTree();
        });
        
        // Play/pause button
        document.getElementById('play-pause').addEventListener('click', () => {
            this.engine.togglePlayMode();
            
            // If entering play mode, detach transform controls
            if (this.engine.isPlaying) {
                this.transformControl.detach();
            }
        });
        
        // Add transformation mode buttons
        const transformModes = ['translate', 'rotate', 'scale'];
        
        transformModes.forEach(mode => {
            const button = document.createElement('button');
            button.id = `transform-${mode}`;
            button.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
            button.addEventListener('click', () => {
                this.transformControl.setMode(mode);
                
                // Highlight the active mode button
                transformModes.forEach(m => {
                    const btn = document.getElementById(`transform-${m}`);
                    if (btn) {
                        btn.classList.toggle('active', m === mode);
                    }
                });
            });
            
            document.getElementById('toolbar').appendChild(button);
        });
        
        // Activate translate mode by default
        document.getElementById('transform-translate').classList.add('active');
        
        // Initialize assets manager
        this.initAssetsManager();
    }
    
    initAssetsManager() {
        // Sample asset data - in a real implementation, this would come from a backend or file system
        const sampleAssets = [
            { id: 'asset1', name: 'Cube Mesh', type: 'model' },
            { id: 'asset2', name: 'Wood Texture', type: 'texture' },
            { id: 'asset3', name: 'Background Music', type: 'audio' },
            { id: 'asset4', name: 'Player Character', type: 'prefab' },
            { id: 'asset5', name: 'Explosion', type: 'particle' },
            { id: 'asset6', name: 'Level01', type: 'scene' }
        ];
        
        const assetsGrid = document.querySelector('.assets-grid');
        if (assetsGrid) {
            sampleAssets.forEach(asset => {
                const assetItem = document.createElement('div');
                assetItem.className = 'asset-item';
                assetItem.dataset.id = asset.id;
                
                const thumbnail = document.createElement('div');
                thumbnail.className = 'asset-thumbnail';
                
                // Add icon based on asset type
                let iconSvg = '';
                switch (asset.type) {
                    case 'model':
                        iconSvg = '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#aaa" d="M12 18l-8-8h16l-8 8z"></path></svg>';
                        break;
                    case 'texture':
                        iconSvg = '<svg viewBox="0 0 24 24" width="24" height="24"><rect x="4" y="4" width="16" height="16" fill="#aaa"></rect></svg>';
                        break;
                    case 'audio':
                        iconSvg = '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#aaa" d="M3 9v6h4l5 5V4L7 9H3z"></path></svg>';
                        break;
                    case 'prefab':
                        iconSvg = '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#aaa" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"></path></svg>';
                        break;
                    default:
                        iconSvg = '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="8" fill="#aaa"></circle></svg>';
                }
                
                thumbnail.innerHTML = iconSvg;
                
                const name = document.createElement('div');
                name.className = 'asset-name';
                name.textContent = asset.name;
                
                assetItem.appendChild(thumbnail);
                assetItem.appendChild(name);
                
                // Add event listener for drag and drop
                assetItem.setAttribute('draggable', 'true');
                assetItem.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', asset.id);
                });
                
                // Add event listener for click
                assetItem.addEventListener('click', () => {
                    console.log(`Asset clicked: ${asset.name}`);
                    // Future implementation: preview asset or load into scene
                });
                
                assetsGrid.appendChild(assetItem);
            });
        }
    }
    
    initMainToolbar() {
        // New Scene button
        document.getElementById('new-scene').addEventListener('click', () => {
            if (confirm('Create a new scene? All unsaved changes will be lost.')) {
                // Remove all objects except lights
                while (this.engine.objects.length > 0) {
                    const obj = this.engine.objects[0];
                    this.engine.removeObject(obj);
                }
                this.refreshSceneTree();
                this.updateInspector(null);
            }
        });
        
        // Documentation button is already in the HTML, so we don't need to create it here
        
        // Save Scene button (placeholder)
        document.getElementById('save-scene').addEventListener('click', () => {
            alert('Save Scene functionality will be implemented soon');
        });
        
        // Load Scene button (placeholder)
        document.getElementById('load-scene').addEventListener('click', () => {
            alert('Load Scene functionality will be implemented soon');
        });
        
        // Add objects from main toolbar
        document.getElementById('main-add-cube').addEventListener('click', () => {
            this.engine.addCube();
            this.refreshSceneTree();
        });
        
        document.getElementById('main-add-sphere').addEventListener('click', () => {
            this.engine.addSphere();
            this.refreshSceneTree();
        });
        
        document.getElementById('main-add-light').addEventListener('click', () => {
            this.engine.addLight();
            this.refreshSceneTree();
        });
        
        document.getElementById('main-add-camera').addEventListener('click', () => {
            alert('Add Camera functionality will be implemented soon');
        });
        
        // Script button
        document.getElementById('main-add-script').addEventListener('click', () => {
            if (this.engine.selectedObject) {
                this.scriptEditor.openScriptEditor(this.engine.selectedObject);
            } else {
                alert('Please select an object to add a script to');
            }
        });
        
        // Play/Pause/Stop controls
        document.getElementById('main-play').addEventListener('click', () => {
            if (!this.engine.isPlaying) {
                this.engine.togglePlayMode();
            }
        });
        
        document.getElementById('main-pause').addEventListener('click', () => {
            alert('Pause functionality will be implemented soon');
        });
        
        document.getElementById('main-stop').addEventListener('click', () => {
            if (this.engine.isPlaying) {
                this.engine.togglePlayMode();
            }
        });
        
        // Add prefab button
        const prefabButton = document.createElement('button');
        prefabButton.id = 'main-save-prefab';
        prefabButton.textContent = 'Save Prefab';
        prefabButton.addEventListener('click', () => {
            if (this.engine.selectedObject) {
                const prefabName = prompt('Enter a name for this prefab:', this.engine.selectedObject.name);
                if (prefabName) {
                    this.engine.savePrefab(this.engine.selectedObject, prefabName);
                    alert(`Prefab "${prefabName}" saved successfully.`);
                }
            } else {
                alert('Please select an object to save as a prefab');
            }
        });
        
        const createFromPrefabButton = document.createElement('button');
        createFromPrefabButton.id = 'main-create-prefab';
        createFromPrefabButton.textContent = 'Create from Prefab';
        createFromPrefabButton.addEventListener('click', () => {
            if (!this.engine.prefabs || Object.keys(this.engine.prefabs).length === 0) {
                alert('No prefabs available. Save an object as a prefab first.');
                return;
            }
            
            const prefabName = prompt('Enter prefab name to instantiate:');
            if (prefabName && this.engine.prefabs[prefabName]) {
                const newObj = this.engine.instantiatePrefab(prefabName);
                if (newObj) {
                    this.refreshSceneTree();
                    this.engine.selectObject(newObj);
                }
            } else {
                alert(`Prefab "${prefabName}" not found.`);
            }
        });
        
        // Add to main toolbar
        document.getElementById('main-toolbar').querySelector('.section:first-child').appendChild(prefabButton);
        document.getElementById('main-toolbar').querySelector('.section:first-child').appendChild(createFromPrefabButton);
        
        // Add assets manager button
        const assetsManagerButton = document.createElement('button');
        assetsManagerButton.id = 'main-assets-manager';
        assetsManagerButton.textContent = 'Assets Manager';
        assetsManagerButton.addEventListener('click', () => {
            this.openAssetsManager();
        });
        
        // Add to main toolbar - add it to the first section
        document.getElementById('main-toolbar').querySelector('.section:first-child').appendChild(assetsManagerButton);
    }
    
    setupEventListeners() {
        // Listen for object selection changes
        document.addEventListener('object-selected', (event) => {
            this.updateInspector(event.detail.object);
            this.updateSelection();
        });
        
        // Listen for script updates
        document.addEventListener('script-updated', (event) => {
            this.refreshSceneTree();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Delete key to remove selected object
            if (event.key === 'Delete' && this.engine.selectedObject) {
                this.deleteSelectedObject();
            }
            
            // Transformation mode shortcuts
            if (event.key === 'g') this.transformControl.setMode('translate');
            if (event.key === 'r') this.transformControl.setMode('rotate');
            if (event.key === 's') this.transformControl.setMode('scale');
        });
    }
    
    updateSelection() {
        // Update scene tree selection
        const treeItems = this.sceneTreeElement.querySelectorAll('.tree-item');
        treeItems.forEach(item => {
            item.classList.remove('selected');
            
            if (this.engine.selectedObject && 
                item.getAttribute('data-id') === this.engine.selectedObject.id) {
                item.classList.add('selected');
            }
        });
    }
    
    deleteSelectedObject() {
        if (this.engine.selectedObject) {
            this.transformControl.detach();
            this.engine.removeObject(this.engine.selectedObject);
            this.refreshSceneTree();
            this.updateInspector(null);
        }
    }
    
    openAssetsManager() {
        // Create modal for assets manager
        const modal = document.createElement('div');
        modal.className = 'script-editor-modal';
        
        const assetsContent = document.createElement('div');
        assetsContent.className = 'script-editor-content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'script-editor-header';
        header.innerHTML = `<h3>Assets Manager</h3>`;
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'script-editor-close';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        header.appendChild(closeBtn);
        
        // Assets content
        const assetsContainer = document.createElement('div');
        assetsContainer.className = 'assets-popup-content';
        assetsContainer.innerHTML = `
            <div class="assets-grid">
                ${this.generateAssetsHTML()}
            </div>
            <div class="assets-upload">
                <button id="upload-asset-btn">Upload New Asset</button>
                <p>Supported formats: .gltf, .glb, .fbx, .obj, .jpg, .png, .mp3, .wav</p>
            </div>
        `;
        
        // Build modal
        assetsContent.appendChild(header);
        assetsContent.appendChild(assetsContainer);
        modal.appendChild(assetsContent);
        
        // Add to body
        document.body.appendChild(modal);
        
        // Add click event for upload button
        document.getElementById('upload-asset-btn').addEventListener('click', () => {
            alert('Asset upload functionality will be implemented soon');
        });
    }
    
    generateAssetsHTML() {
        // Sample asset data - in a real implementation, this would come from a backend
        const sampleAssets = [
            { id: 'asset1', name: 'Cube Mesh', type: 'model' },
            { id: 'asset2', name: 'Wood Texture', type: 'texture' },
            { id: 'asset3', name: 'Background Music', type: 'audio' },
            { id: 'asset4', name: 'Player Character', type: 'prefab' },
            { id: 'asset5', name: 'Explosion', type: 'particle' },
            { id: 'asset6', name: 'Level01', type: 'scene' },
            { id: 'asset7', name: 'Grass Texture', type: 'texture' },
            { id: 'asset8', name: 'Character Animations', type: 'animation' },
            { id: 'asset9', name: 'UI Elements', type: 'sprite' },
            { id: 'asset10', name: 'Vehicle Model', type: 'model' },
            { id: 'asset11', name: 'Footstep Sound', type: 'audio' },
            { id: 'asset12', name: 'Enemy Prefab', type: 'prefab' }
        ];
        
        let html = '';
        sampleAssets.forEach(asset => {
            html += `
                <div class="asset-item" data-id="${asset.id}">
                    <div class="asset-thumbnail asset-type-${asset.type}"></div>
                    <div class="asset-name">${asset.name}</div>
                    <div class="asset-type">${asset.type}</div>
                </div>
            `;
        });
        
        return html;
    }
    
    openComponentBrowser(obj) {
        // Create modal for component browser
        const modal = document.createElement('div');
        modal.className = 'script-editor-modal';
        
        const browserContent = document.createElement('div');
        browserContent.className = 'script-editor-content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'script-editor-header';
        header.innerHTML = `<h3>Component Browser - ${obj.name}</h3>`;
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'script-editor-close';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        header.appendChild(closeBtn);
        
        // Get entity if it exists
        const entity = this.engine.ecs.getEntityFromObject(obj);
        
        // Component content
        const componentsContainer = document.createElement('div');
        componentsContainer.className = 'component-browser-content';
        
        // Add components list
        const componentsList = document.createElement('div');
        componentsList.className = 'components-list';
        
        // Add title
        const title = document.createElement('h4');
        title.textContent = 'Available Components';
        componentsList.appendChild(title);
        
        // Add component types
        const componentTypes = [
            { name: 'Transform Component', type: TransformComponent },
            { name: 'Render Component', type: RenderComponent },
            { name: 'Physics Component', type: PhysicsComponent }
        ];
        
        componentTypes.forEach(comp => {
            const componentItem = document.createElement('div');
            componentItem.className = 'component-item';
            
            // Check if entity already has this component
            const hasComponent = entity && entity.hasComponent(comp.type);
            
            componentItem.innerHTML = `
                <div class="component-name">${comp.name}</div>
                <button class="component-action-btn">${hasComponent ? 'Remove' : 'Add'}</button>
            `;
            
            // Add event listener
            const button = componentItem.querySelector('.component-action-btn');
            button.addEventListener('click', () => {
                if (!entity) {
                    // Create entity if it doesn't exist
                    const newEntity = this.engine.ecs.createEntity(obj);
                    newEntity.addComponent(comp.type);
                    alert(`Added ${comp.name} to ${obj.name}`);
                    // Update button text
                    button.textContent = 'Remove';
                } else if (hasComponent) {
                    // Remove component
                    entity.removeComponent(comp.type);
                    alert(`Removed ${comp.name} from ${obj.name}`);
                    button.textContent = 'Add';
                } else {
                    // Add component
                    entity.addComponent(comp.type);
                    alert(`Added ${comp.name} to ${obj.name}`);
                    button.textContent = 'Remove';
                }
            });
            
            componentsList.appendChild(componentItem);
        });
        
        componentsContainer.appendChild(componentsList);
        
        // Current components section (if entity exists)
        if (entity) {
            const currentComponents = document.createElement('div');
            currentComponents.className = 'current-components';
            
            const currentTitle = document.createElement('h4');
            currentTitle.textContent = 'Current Components';
            currentComponents.appendChild(currentTitle);
            
            if (entity.components.size === 0) {
                const noComponents = document.createElement('div');
                noComponents.textContent = 'No components attached to this entity';
                currentComponents.appendChild(noComponents);
            } else {
                entity.components.forEach((component, name) => {
                    const componentInfo = document.createElement('div');
                    componentInfo.className = 'component-info';
                    componentInfo.innerHTML = `
                        <div class="component-info-name">${name}</div>
                        <div class="component-info-properties">
                            <pre>${JSON.stringify(component._properties, null, 2)}</pre>
                        </div>
                    `;
                    currentComponents.appendChild(componentInfo);
                });
            }
            
            componentsContainer.appendChild(currentComponents);
        }
        
        // Build modal
        browserContent.appendChild(header);
        browserContent.appendChild(componentsContainer);
        modal.appendChild(browserContent);
        
        // Add to body
        document.body.appendChild(modal);
    }
}

export default EngineUI;