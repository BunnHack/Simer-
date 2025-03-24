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
        
        // Add Components button
        const addComponentsButton = document.createElement('button');
        addComponentsButton.textContent = 'Add Components';
        addComponentsButton.className = 'add-components-btn';
        addComponentsButton.addEventListener('click', () => {
            if (this.engine.selectedObject) {
                this.openComponentBrowser(this.engine.selectedObject);
            } else {
                alert('Please select an object first');
            }
        });
        
        // Add button to hierarchy panel header
        const hierarchyHeader = document.querySelector('#scene-hierarchy .panel-header');
        hierarchyHeader.style.display = 'flex';
        hierarchyHeader.style.justifyContent = 'space-between';
        hierarchyHeader.style.alignItems = 'center';
        hierarchyHeader.appendChild(addComponentsButton);
        
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
            this.duplicateObject(obj);
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
        
        // We'll add the button after creating the main toolbar, not here
        
        // Store the button for later use
        this.componentBrowserButton = componentBrowserButton;
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
        // Create tabs container
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'toolbar-tabs';
        
        // Create tab panels container
        const toolbarContent = document.createElement('div');
        toolbarContent.className = 'toolbar-content';
        
        // Define tabs
        const tabs = [
            { id: 'file-tab', label: 'File', active: true },
            { id: 'edit-tab', label: 'Edit', active: false },
            { id: 'object-tab', label: 'Object', active: false },
            { id: 'component-tab', label: 'Component', active: false },
            { id: 'view-tab', label: 'View', active: false },
            { id: 'play-tab', label: 'Play', active: false },
            { id: 'assets-tab', label: 'Assets', active: false } 
        ];
        
        // Create tabs and panels
        tabs.forEach(tabInfo => {
            // Create tab
            const tab = document.createElement('div');
            tab.id = tabInfo.id;
            tab.className = `tab ${tabInfo.active ? 'active' : ''}`;
            tab.textContent = tabInfo.label;
            tab.addEventListener('click', () => this.switchTab(tabInfo.id));
            tabsContainer.appendChild(tab);
            
            // Create tab panel
            const panel = document.createElement('div');
            panel.id = `${tabInfo.id}-panel`;
            panel.className = `tab-panel ${tabInfo.active ? 'active' : ''}`;
            toolbarContent.appendChild(panel);
            
            // Add sections to panel
            const section = document.createElement('div');
            section.className = 'section';
            panel.appendChild(section);
        });
        
        // Replace existing main toolbar content
        const mainToolbar = document.getElementById('main-toolbar');
        mainToolbar.innerHTML = '';
        mainToolbar.appendChild(tabsContainer);
        mainToolbar.appendChild(toolbarContent);
        
        // Populate File tab
        const filePanel = document.getElementById('file-tab-panel');
        const fileSection = filePanel.querySelector('.section');
        fileSection.innerHTML = `
            <button id="new-scene">New Scene</button>
            <button id="save-scene">Save Scene</button>
            <button id="load-scene">Load Scene</button>
        `;
        
        // Populate Object tab
        const objectPanel = document.getElementById('object-tab-panel');
        const objectSection = objectPanel.querySelector('.section');
        objectSection.innerHTML = `
            <button id="main-add-cube">Cube</button>
            <button id="main-add-sphere">Sphere</button>
            <button id="main-add-light">Light</button>
            <button id="main-add-camera">Camera</button>
            <button id="main-duplicate-object">Duplicate</button>
        `;
        
        // Populate Component tab
        const componentPanel = document.getElementById('component-tab-panel');
        const componentSection = componentPanel.querySelector('.section');
        componentSection.innerHTML = `
            <button id="main-add-script">Script</button>
        `;
        
        if (this.componentBrowserButton) {
            componentSection.appendChild(this.componentBrowserButton);
        }
        
        // Populate Play tab
        const playPanel = document.getElementById('play-tab-panel');
        const playSection = playPanel.querySelector('.section');
        playSection.innerHTML = `
            <button id="main-play">Play</button>
            <button id="main-pause">Pause</button>
            <button id="main-stop">Stop</button>
        `;
        
        // Populate Edit tab
        const editPanel = document.getElementById('edit-tab-panel');
        const editSection = editPanel.querySelector('.section');
        editSection.innerHTML = `
            <button id="main-save-prefab">Save Prefab</button>
            <button id="main-create-prefab">Create from Prefab</button>
            <button id="main-docs" onclick="window.open('docs.html', '_blank')">Documentation</button>
        `;
        
        // Populate View tab
        const viewPanel = document.getElementById('view-tab-panel');
        const viewSection = viewPanel.querySelector('.section');
        viewSection.innerHTML = `
            <button id="view-toggle-console">Toggle Console</button>
            <div class="transform-tools">
                <button id="transform-translate" class="transform-btn active">Translate</button>
                <button id="transform-rotate" class="transform-btn">Rotate</button>
                <button id="transform-scale" class="transform-btn">Scale</button>
            </div>
            <button id="view-toggle-grid">Toggle Grid</button>
        `;
        
        // Populate Assets tab
        const assetsPanel = document.getElementById('assets-tab-panel');
        const assetsSection = assetsPanel.querySelector('.section');
        assetsSection.innerHTML = `
            <button id="main-assets-manager">Assets Manager</button>
            <button id="main-import-asset">Import Asset</button>
            <button id="main-export-asset">Export Asset</button>
        `;
        
        // Add event listeners (reusing the existing code)
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
        
        document.getElementById('save-scene').addEventListener('click', () => {
            const sceneData = this.engine.saveScene();
            
            // Convert to JSON string
            const jsonString = JSON.stringify(sceneData, null, 2);
            
            // Create a blob and download link
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'scene.json';
            a.click();
            
            URL.revokeObjectURL(url);
            
            alert('Scene saved successfully!');
        });
        
        document.getElementById('load-scene').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = (event) => {
                const file = event.target.files[0];
                if (!file) return;
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const sceneData = JSON.parse(e.target.result);
                        const success = this.engine.loadScene(sceneData);
                        
                        if (success) {
                            this.refreshSceneTree();
                            alert('Scene loaded successfully!');
                        } else {
                            alert('Error loading scene: Invalid scene data');
                        }
                    } catch (error) {
                        console.error('Error parsing scene file:', error);
                        alert(`Error loading scene: ${error.message}`);
                    }
                };
                
                reader.readAsText(file);
            };
            
            input.click();
        });
        
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
        
        document.getElementById('main-add-script').addEventListener('click', () => {
            if (this.engine.selectedObject) {
                this.scriptEditor.openScriptEditor(this.engine.selectedObject);
            } else {
                alert('Please select an object to add a script to');
            }
        });
        
        document.getElementById('main-play').addEventListener('click', () => {
            if (!this.engine.isPlaying) {
                this.engine.togglePlayMode();
            }
        });
        
        document.getElementById('main-pause').addEventListener('click', () => {
            if (this.engine.isPlaying) {
                this.engine.pauseGame();
            }
        });
        
        document.getElementById('main-stop').addEventListener('click', () => {
            if (this.engine.isPlaying) {
                this.engine.togglePlayMode();
            }
        });
        
        document.getElementById('main-save-prefab').addEventListener('click', () => {
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
        
        document.getElementById('main-create-prefab').addEventListener('click', () => {
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
        
        document.getElementById('main-assets-manager').addEventListener('click', () => {
            this.openAssetsManager();
        });
        
        document.getElementById('main-docs').addEventListener('click', () => {
            window.open('docs.html', '_blank');
        });
        
        document.getElementById('transform-translate').addEventListener('click', () => {
            this.setTransformMode('translate');
        });
        
        document.getElementById('transform-rotate').addEventListener('click', () => {
            this.setTransformMode('rotate');
        });
        
        document.getElementById('transform-scale').addEventListener('click', () => {
            this.setTransformMode('scale');
        });
        
        document.getElementById('view-toggle-console').addEventListener('click', () => {
            this.toggleConsolePanel();
        });
        
        document.getElementById('main-export-asset').addEventListener('click', () => {
            this.exportProjectAsZip();
        });
        
        document.getElementById('main-duplicate-object').addEventListener('click', () => {
            if (this.engine.selectedObject) {
                this.duplicateObject(this.engine.selectedObject);
            } else {
                alert('Please select an object to duplicate');
            }
        });
    }
    
    switchTab(tabId) {
        // Deactivate all tabs and panels
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        
        // Activate the selected tab and panel
        document.getElementById(tabId).classList.add('active');
        document.getElementById(`${tabId}-panel`).classList.add('active');
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
        
        // Initialize console
        this.initConsole();
    }
    
    initConsole() {
        // Get console elements
        this.consoleOutput = document.getElementById('console-output');
        const clearButton = document.getElementById('clear-console');
        
        // Clear console button
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.consoleOutput.innerHTML = '';
            });
        }
        
        // Override console methods to capture logs
        this.overrideConsole();
        
        // Add initial message
        this.log('Console initialized. Engine ready.');
    }
    
    overrideConsole() {
        const originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error
        };
        
        const ui = this;
        
        // Override console.log
        console.log = function() {
            // Call original method
            originalConsole.log.apply(console, arguments);
            
            // Format arguments into a string
            const message = Array.from(arguments)
                .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
                .join(' ');
                
            // Add to our console
            ui.log(message);
        };
        
        // Override console.info
        console.info = function() {
            originalConsole.info.apply(console, arguments);
            const message = Array.from(arguments)
                .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
                .join(' ');
            ui.info(message);
        };
        
        // Override console.warn
        console.warn = function() {
            originalConsole.warn.apply(console, arguments);
            const message = Array.from(arguments)
                .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
                .join(' ');
            ui.warn(message);
        };
        
        // Override console.error
        console.error = function() {
            originalConsole.error.apply(console, arguments);
            const message = Array.from(arguments)
                .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
                .join(' ');
            ui.error(message);
        };
    }
    
    log(message) {
        this.addConsoleMessage(message, 'log');
    }
    
    info(message) {
        this.addConsoleMessage(message, 'info');
    }
    
    warn(message) {
        this.addConsoleMessage(message, 'warn');
    }
    
    error(message) {
        this.addConsoleMessage(message, 'error');
    }
    
    addConsoleMessage(message, type) {
        if (!this.consoleOutput) return;
        
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `console-${type}`;
        entry.textContent = `[${time}] ${message}`;
        
        this.consoleOutput.appendChild(entry);
        
        // Auto-scroll to bottom
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
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
            { name: 'Physics Component', type: PhysicsComponent },
            // Add shader component
            { name: 'Shader Component', type: 'shader', isCustom: true },
            // Add material component
            { name: 'Material Component', type: 'material', isCustom: true }
        ];
        
        componentTypes.forEach(comp => {
            const componentItem = document.createElement('div');
            componentItem.className = 'component-item';
            
            // Check if entity already has this component
            const hasComponent = entity && !comp.isCustom && entity.hasComponent(comp.type);
            
            componentItem.innerHTML = `
                <div class="component-name">${comp.name}</div>
                <button class="component-action-btn">${hasComponent ? 'Remove' : 'Add'}</button>
            `;
            
            // Add event listener
            const button = componentItem.querySelector('.component-action-btn');
            button.addEventListener('click', () => {
                if (comp.isCustom) {
                    if (comp.type === 'shader') {
                        this.openShaderEditor(obj);
                    } else if (comp.type === 'material') {
                        this.openMaterialEditor(obj);
                    }
                    document.body.removeChild(modal);
                } else if (!entity) {
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
    
    setTransformMode(mode) {
        // Update transform control mode
        this.transformControl.setMode(mode);
        
        // Update active button state
        const buttons = document.querySelectorAll('.transform-btn');
        buttons.forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`transform-${mode}`).classList.add('active');
    }
    
    toggleConsolePanel() {
        const consolePanel = document.getElementById('console-panel');
        consolePanel.style.display = consolePanel.style.display === 'none' ? 'flex' : 'none';
    }
    
    exportProjectAsZip() {
        // Check if JSZip is loaded, otherwise load it
        if (typeof JSZip === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => this.createAndDownloadZip();
            document.head.appendChild(script);
        } else {
            this.createAndDownloadZip();
        }
    }

    createAndDownloadZip() {
        const zip = new JSZip();
        
        // Add scene data
        const sceneData = this.engine.saveScene();
        zip.file("scene.json", JSON.stringify(sceneData, null, 2));
        
        // Add scripts
        const scripts = new Map();
        this.engine.objects.forEach(obj => {
            if (obj.script) {
                const fileName = obj.scriptFileName || `${obj.name}.js`;
                scripts.set(fileName, obj.script);
            }
        });
        
        // Create scripts folder
        const scriptsFolder = zip.folder("scripts");
        scripts.forEach((content, fileName) => {
            scriptsFolder.file(fileName, content);
        });
        
        // Add config
        const configStr = `export const config = ${JSON.stringify(this.engine.config || {}, null, 2)};`;
        zip.file("config.js", configStr);
        
        // Add readme
        const readme = `# Three.js Game Engine Project
Exported on: ${new Date().toLocaleString()}

## Contents
- scene.json: The main scene data
- scripts/: Contains all script files
- config.js: Engine configuration

## How to Use
1. Load this project back into the Three.js Game Engine
2. Or use the scene.json with a compatible Three.js application

## Scripts
${Array.from(scripts.keys()).map(name => `- ${name}`).join('\n')}
`;
        zip.file("README.md", readme);
        
        // Generate the zip file
        zip.generateAsync({ type: "blob" })
            .then(content => {
                // Create download link
                const url = URL.createObjectURL(content);
                const a = document.createElement('a');
                a.href = url;
                a.download = "three-js-game-engine-project.zip";
                a.click();
                URL.revokeObjectURL(url);
            });
    }
    
    duplicateObject(obj) {
        // Create a copy of the object
        let newObj;
        if (obj.type === 'cube') {
            newObj = this.engine.addCube();
        } else if (obj.type === 'sphere') {
            newObj = this.engine.addSphere();
        } else if (obj.type === 'light') {
            newObj = this.engine.addLight();
        } else {
            alert('Cannot duplicate this type of object');
            return;
        }
        
        // Copy transform properties
        newObj.object3D.position.copy(obj.object3D.position);
        newObj.object3D.rotation.copy(obj.object3D.rotation);
        newObj.object3D.scale.copy(obj.object3D.scale);
        
        // Copy material properties if exists
        if (obj.object3D.material && newObj.object3D.material) {
            newObj.object3D.material.color.copy(obj.object3D.material.color);
            newObj.object3D.material.wireframe = obj.object3D.material.wireframe;
            newObj.object3D.material.transparent = obj.object3D.material.transparent;
            newObj.object3D.material.opacity = obj.object3D.material.opacity;
            if (obj.object3D.material.metalness !== undefined) {
                newObj.object3D.material.metalness = obj.object3D.material.metalness;
            }
            if (obj.object3D.material.roughness !== undefined) {
                newObj.object3D.material.roughness = obj.object3D.material.roughness;
            }
        }
        
        // Copy script
        if (obj.script) {
            newObj.script = obj.script;
            newObj.scriptFileName = obj.scriptFileName;
        }
        
        // Copy tags if any
        if (obj.tags) {
            for (const tag of obj.tags) {
                this.engine.scriptingSystem.addTag(newObj, tag);
            }
        }
        
        // Place the new object slightly offset from the original
        newObj.object3D.position.x += 1;
        
        // Select the new object
        this.engine.selectObject(newObj);
        
        // Update the scene tree
        this.refreshSceneTree();
        
        return newObj;
    }
    
    openShaderEditor(obj) {
        // Create modal for shader editor
        const modal = document.createElement('div');
        modal.className = 'script-editor-modal';
        
        const shaderContent = document.createElement('div');
        shaderContent.className = 'script-editor-content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'script-editor-header';
        header.innerHTML = `<h3>Shader Editor - ${obj.name}</h3>`;
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'script-editor-close';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        header.appendChild(closeBtn);
        
        // Get current shader if exists
        const currentShader = obj.customShader || {
            vertex: `
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragment: `
                uniform vec3 color;
                uniform float time;
                varying vec2 vUv;
                
                void main() {
                    vec3 finalColor = color;
                    // Simple color animation
                    finalColor.r *= 0.5 + 0.5 * sin(vUv.x * 10.0 + time);
                    finalColor.g *= 0.5 + 0.5 * sin(vUv.y * 10.0 + time);
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            uniforms: {
                color: { value: new THREE.Color(0x4b80ff) },
                time: { value: 0 }
            }
        };
        
        // Create tabs for vertex and fragment shaders
        const tabs = document.createElement('div');
        tabs.className = 'tabs';
        tabs.innerHTML = `
            <div class="tab active" data-tab="vertex">Vertex Shader</div>
            <div class="tab" data-tab="fragment">Fragment Shader</div>
            <div class="tab" data-tab="uniforms">Uniforms</div>
        `;
        
        // Create shader containers
        const shaderContainers = document.createElement('div');
        shaderContainers.className = 'shader-containers';
        
        // Vertex shader editor
        const vertexEditor = document.createElement('div');
        vertexEditor.className = 'shader-editor active';
        vertexEditor.setAttribute('data-content', 'vertex');
        
        const vertexCodeEditor = document.createElement('div');
        vertexCodeEditor.className = 'code-editor';
        vertexCodeEditor.contentEditable = 'true';
        vertexCodeEditor.spellcheck = false;
        vertexCodeEditor.textContent = currentShader.vertex;
        
        vertexEditor.appendChild(vertexCodeEditor);
        
        // Fragment shader editor
        const fragmentEditor = document.createElement('div');
        fragmentEditor.className = 'shader-editor';
        fragmentEditor.setAttribute('data-content', 'fragment');
        
        const fragmentCodeEditor = document.createElement('div');
        fragmentCodeEditor.className = 'code-editor';
        fragmentCodeEditor.contentEditable = 'true';
        fragmentCodeEditor.spellcheck = false;
        fragmentCodeEditor.textContent = currentShader.fragment;
        
        fragmentEditor.appendChild(fragmentCodeEditor);
        
        // Uniforms editor
        const uniformsEditor = document.createElement('div');
        uniformsEditor.className = 'shader-editor';
        uniformsEditor.setAttribute('data-content', 'uniforms');
        
        const uniformsContainer = document.createElement('div');
        uniformsContainer.className = 'uniforms-container';
        
        // Create uniform inputs
        const addUniforms = (uniforms = {}) => {
            uniformsContainer.innerHTML = '';
            
            // Add default uniforms
            const defaultUniforms = {
                color: { value: currentShader.uniforms.color?.value || new THREE.Color(0x4b80ff) },
                time: { value: 0 }
            };
            
            const allUniforms = { ...defaultUniforms, ...uniforms };
            
            // Create uniform inputs
            for (const [name, uniform] of Object.entries(allUniforms)) {
                const uniformRow = document.createElement('div');
                uniformRow.className = 'uniform-row';
                
                const nameLabel = document.createElement('div');
                nameLabel.className = 'uniform-name';
                nameLabel.textContent = name;
                
                const valueInput = document.createElement('div');
                valueInput.className = 'uniform-value';
                
                // Create different input types based on uniform type
                if (uniform.value instanceof THREE.Color) {
                    // Color picker
                    const colorInput = document.createElement('input');
                    colorInput.type = 'color';
                    colorInput.value = '#' + uniform.value.getHexString();
                    valueInput.appendChild(colorInput);
                } else if (typeof uniform.value === 'number') {
                    // Number input
                    const numberInput = document.createElement('input');
                    numberInput.type = 'number';
                    numberInput.value = uniform.value;
                    numberInput.step = '0.1';
                    valueInput.appendChild(numberInput);
                } else if (uniform.value instanceof THREE.Vector2) {
                    // Vector2 input
                    const xInput = document.createElement('input');
                    xInput.type = 'number';
                    xInput.value = uniform.value.x;
                    xInput.step = '0.1';
                    xInput.placeholder = 'X';
                    
                    const yInput = document.createElement('input');
                    yInput.type = 'number';
                    yInput.value = uniform.value.y;
                    yInput.step = '0.1';
                    yInput.placeholder = 'Y';
                    
                    valueInput.appendChild(xInput);
                    valueInput.appendChild(yInput);
                } else {
                    // Default text input
                    const textInput = document.createElement('input');
                    textInput.type = 'text';
                    textInput.value = String(uniform.value);
                    valueInput.appendChild(textInput);
                }
                
                uniformRow.appendChild(nameLabel);
                uniformRow.appendChild(valueInput);
                uniformsContainer.appendChild(uniformRow);
            }
            
            // Add button to add new uniform
            const addButton = document.createElement('button');
            addButton.textContent = 'Add Uniform';
            addButton.className = 'add-uniform-btn';
            addButton.addEventListener('click', () => {
                const name = prompt('Enter uniform name:');
                if (name) {
                    const type = prompt('Enter uniform type (color, number, vector2):');
                    
                    let value;
                    switch (type) {
                        case 'color':
                            value = { value: new THREE.Color(0xffffff) };
                            break;
                        case 'vector2':
                            value = { value: new THREE.Vector2(0, 0) };
                            break;
                        case 'number':
                        default:
                            value = { value: 0 };
                    }
                    
                    const newUniforms = { ...allUniforms, [name]: value };
                    addUniforms(newUniforms);
                }
            });
            
            uniformsContainer.appendChild(addButton);
        };
        
        // Add initial uniforms
        addUniforms(currentShader.uniforms);
        
        uniformsEditor.appendChild(uniformsContainer);
        
        // Add editors to containers
        shaderContainers.appendChild(vertexEditor);
        shaderContainers.appendChild(fragmentEditor);
        shaderContainers.appendChild(uniformsEditor);
        
        // Tab switching logic
        tabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                // Update active tab
                const tabs = document.querySelectorAll('.tab');
                tabs.forEach(tab => tab.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update active content
                const tabName = e.target.getAttribute('data-tab');
                const contents = document.querySelectorAll('.shader-editor');
                contents.forEach(content => {
                    content.classList.toggle('active', content.getAttribute('data-content') === tabName);
                });
            }
        });
        
        // Shader preview canvas
        const previewContainer = document.createElement('div');
        previewContainer.className = 'shader-preview';
        
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        previewContainer.appendChild(canvas);
        
        // Add preview renderer
        const createPreviewRenderer = () => {
            const width = canvas.width;
            const height = canvas.height;
            
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            renderer.setSize(width, height);
            
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
            camera.position.z = 2;
            
            // Create preview mesh
            const geometry = new THREE.SphereGeometry(0.8, 32, 32);
            
            // Create material from current shader
            const getUpdatedShaderCode = () => {
                return {
                    vertex: vertexCodeEditor.textContent,
                    fragment: fragmentCodeEditor.textContent
                };
            };
            
            // Create initial material
            const material = new THREE.ShaderMaterial({
                vertexShader: currentShader.vertex,
                fragmentShader: currentShader.fragment,
                uniforms: currentShader.uniforms
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            
            // Add lights
            const light = new THREE.DirectionalLight(0xffffff, 1);
            light.position.set(0, 1, 1);
            scene.add(light);
            
            scene.add(new THREE.AmbientLight(0x404040));
            
            // Render function
            let time = 0;
            
            const render = () => {
                // Update shader if code has changed
                const newShaderCode = getUpdatedShaderCode();
                
                if (newShaderCode.vertex !== material.vertexShader || 
                    newShaderCode.fragment !== material.fragmentShader) {
                    try {
                        material.vertexShader = newShaderCode.vertex;
                        material.fragmentShader = newShaderCode.fragment;
                        material.needsUpdate = true;
                    } catch (error) {
                        console.error('Shader compilation error:', error);
                    }
                }
                
                // Update time uniform
                time += 0.01;
                if (material.uniforms.time) {
                    material.uniforms.time.value = time;
                }
                
                // Rotate the preview mesh
                mesh.rotation.y += 0.01;
                
                renderer.render(scene, camera);
                requestAnimationFrame(render);
            };
            
            render();
            
            return { renderer, scene, camera, mesh, material };
        };
        
        // Create the preview renderer
        let preview;
        
        // Buttons container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'script-editor-buttons';
        
        // Apply button
        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply Shader';
        applyBtn.className = 'script-editor-button';
        applyBtn.addEventListener('click', () => {
            try {
                // Get updated shader code
                const vertexShader = vertexCodeEditor.textContent;
                const fragmentShader = fragmentCodeEditor.textContent;
                
                // Parse uniforms from inputs
                const uniforms = {};
                const uniformInputs = uniformsContainer.querySelectorAll('.uniform-row');
                
                uniformInputs.forEach(row => {
                    const name = row.querySelector('.uniform-name').textContent;
                    const valueInput = row.querySelector('.uniform-value').children[0];
                    
                    if (valueInput.type === 'color') {
                        uniforms[name] = { value: new THREE.Color(valueInput.value) };
                    } else if (valueInput.type === 'number') {
                        uniforms[name] = { value: parseFloat(valueInput.value) };
                    } else {
                        // Try to handle vector2 (has two inputs)
                        const inputs = row.querySelectorAll('input');
                        if (inputs.length === 2) {
                            uniforms[name] = { 
                                value: new THREE.Vector2(
                                    parseFloat(inputs[0].value), 
                                    parseFloat(inputs[1].value)
                                ) 
                            };
                        } else {
                            uniforms[name] = { value: valueInput.value };
                        }
                    }
                });
                
                // Create the shader material using the engine's shader system
                const material = this.engine.shaderSystem.createShaderMaterial({
                    vertex: vertexShader,
                    fragment: fragmentShader
                }, uniforms);
                
                // Apply to object
                if (obj.object3D) {
                    // Store original material
                    obj.originalMaterial = obj.object3D.material;
                    
                    // Apply new material
                    obj.object3D.material = material;
                    
                    // Store shader
                    obj.customShader = {
                        vertex: vertexShader,
                        fragment: fragmentShader,
                        uniforms: uniforms
                    };
                    
                    alert('Shader applied successfully!');
                    
                    // Close modal
                    document.body.removeChild(modal);
                }
            } catch (error) {
                alert('Error applying shader: ' + error.message);
                console.error('Error applying shader:', error);
            }
        });
        
        // Test button
        const testBtn = document.createElement('button');
        testBtn.textContent = 'Test Shader';
        testBtn.className = 'script-editor-button';
        testBtn.addEventListener('click', () => {
            try {
                // Initialize preview if not already created
                if (!preview) {
                    preview = createPreviewRenderer();
                    previewContainer.style.display = 'block';
                }
                
                // Update shader in preview
                preview.material.vertexShader = vertexCodeEditor.textContent;
                preview.material.fragmentShader = fragmentCodeEditor.textContent;
                preview.material.needsUpdate = true;
                
                // Update uniforms
                // (would need to parse uniforms from inputs here)
            } catch (error) {
                alert('Error testing shader: ' + error.message);
                console.error('Error testing shader:', error);
            }
        });
        
        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Shader';
        saveBtn.className = 'script-editor-button script-editor-save';
        saveBtn.addEventListener('click', () => {
            const shaderName = prompt('Enter a name for this shader:', obj.name + '_Shader');
            if (shaderName) {
                try {
                    // Save shader to library
                    this.engine.shaderSystem.registerShader(shaderName, {
                        vertex: vertexCodeEditor.textContent,
                        fragment: fragmentCodeEditor.textContent
                    });
                    
                    alert(`Shader "${shaderName}" saved to library`);
                } catch (error) {
                    alert('Error saving shader: ' + error.message);
                    console.error('Error saving shader:', error);
                }
            }
        });
        
        // Add buttons to container
        buttonContainer.appendChild(testBtn);
        buttonContainer.appendChild(applyBtn);
        buttonContainer.appendChild(saveBtn);
        
        // CSS for shader editor
        const style = document.createElement('style');
        style.textContent = `
            .tabs {
                display: flex;
                margin-bottom: 10px;
            }
            
            .tab {
                padding: 8px 16px;
                background-color: #333;
                cursor: pointer;
                border-radius: 4px 4px 0 0;
                margin-right: 2px;
            }
            
            .tab.active {
                background-color: #444;
            }
            
            .shader-editor {
                display: none;
                height: 300px;
                overflow: auto;
            }
            
            .shader-editor.active {
                display: block;
            }
            
            .uniforms-container {
                padding: 10px;
                background-color: #333;
                max-height: 280px;
                overflow: auto;
            }
            
            .uniform-row {
                display: flex;
                margin-bottom: 8px;
                align-items: center;
            }
            
            .uniform-name {
                width: 100px;
                font-weight: bold;
            }
            
            .uniform-value {
                flex: 1;
                display: flex;
                gap: 5px;
            }
            
            .uniform-value input {
                flex: 1;
                background-color: #444;
                border: 1px solid #555;
                padding: 4px;
                color: white;
            }
            
            .add-uniform-btn {
                background-color: #555;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
                cursor: pointer;
                margin-top: 10px;
            }
            
            .shader-preview {
                margin-top: 10px;
                text-align: center;
                display: none;
            }
            
            .shader-preview canvas {
                background-color: #333;
                border-radius: 5px;
            }
        `;
        
        document.head.appendChild(style);
        
        // Build modal
        shaderContent.appendChild(header);
        shaderContent.appendChild(tabs);
        shaderContent.appendChild(shaderContainers);
        shaderContent.appendChild(previewContainer);
        shaderContent.appendChild(buttonContainer);
        modal.appendChild(shaderContent);
        
        // Add to body
        document.body.appendChild(modal);
    }
    
    openMaterialEditor(obj) {
        // Create modal for material editor
        const modal = document.createElement('div');
        modal.className = 'script-editor-modal';
        
        const materialContent = document.createElement('div');
        materialContent.className = 'script-editor-content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'script-editor-header';
        header.innerHTML = `<h3>Material Editor - ${obj.name}</h3>`;
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'script-editor-close';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        header.appendChild(closeBtn);
        
        // Material presets list
        const presetsList = document.createElement('div');
        presetsList.className = 'material-presets';
        
        // Add title
        const title = document.createElement('h4');
        title.textContent = 'Material Presets';
        presetsList.appendChild(title);
        
        // Get material presets
        const presets = [
            'metal', 'plastic', 'glass', 'wood', 'clay', 
            'emissive', 'water', 'matcap'
        ];
        
        // Create preset grid
        const presetsGrid = document.createElement('div');
        presetsGrid.className = 'presets-grid';
        
        presets.forEach(preset => {
            const presetItem = document.createElement('div');
            presetItem.className = 'preset-item';
            presetItem.dataset.preset = preset;
            presetItem.innerHTML = `
                <div class="preset-preview ${preset}-preview"></div>
                <div class="preset-name">${preset}</div>
            `;
            
            // Add click event
            presetItem.addEventListener('click', () => {
                // Set active preset
                document.querySelectorAll('.preset-item').forEach(item => {
                    item.classList.remove('active');
                });
                presetItem.classList.add('active');
                
                // Update material properties UI
                updateMaterialPropertiesUI(preset);
            });
            
            presetsGrid.appendChild(presetItem);
        });
        
        presetsList.appendChild(presetsGrid);
        
        // Material properties editor
        const propertiesEditor = document.createElement('div');
        propertiesEditor.className = 'material-properties';
        
        // Add title
        const propsTitle = document.createElement('h4');
        propsTitle.textContent = 'Material Properties';
        propertiesEditor.appendChild(propsTitle);
        
        // Material properties container
        const propertiesContainer = document.createElement('div');
        propertiesContainer.className = 'properties-container';
        
        // Function to update properties UI based on selected preset
        const updateMaterialPropertiesUI = (preset) => {
            // Create basic properties for all materials
            const props = {
                type: 'standard',
                color: '#4b80ff',
                metalness: 0.0,
                roughness: 0.5,
                transparent: false,
                opacity: 1.0
            };
            
            // Add preset-specific properties
            switch (preset) {
                case 'metal':
                    props.metalness = 1.0;
                    props.roughness = 0.2;
                    props.color = '#8c8c8c';
                    break;
                case 'plastic':
                    props.metalness = 0.0;
                    props.roughness = 0.7;
                    props.clearcoat = 0.5;
                    props.clearcoatRoughness = 0.3;
                    props.color = '#ffffff';
                    break;
                case 'glass':
                    props.type = 'physical';
                    props.metalness = 0.0;
                    props.roughness = 0.1;
                    props.transmission = 0.9;
                    props.ior = 1.5;
                    props.transparent = true;
                    props.opacity = 0.5;
                    props.color = '#ffffff';
                    break;
                case 'wood':
                    props.metalness = 0.0;
                    props.roughness = 0.8;
                    props.color = '#a06235';
                    break;
                case 'clay':
                    props.type = 'toon';
                    props.color = '#f5d1b8';
                    break;
                case 'emissive':
                    props.emissive = '#ffffff';
                    props.emissiveIntensity = 1.0;
                    props.color = '#ffffff';
                    break;
                case 'water':
                    props.type = 'physical';
                    props.color = '#2389da';
                    props.metalness = 0.0;
                    props.roughness = 0.1;
                    props.transmission = 0.9;
                    props.transparent = true;
                    props.opacity = 0.8;
                    break;
                case 'matcap':
                    props.type = 'matcap';
                    props.color = '#ffffff';
                    break;
            }
            
            // Populate UI with properties
            propertiesContainer.innerHTML = '';
            
            // Type selector
            const typeRow = createPropertyRow('Material Type', 'select', 'type', props.type, {
                options: ['standard', 'physical', 'basic', 'phong', 'lambert', 'toon', 'normal', 'matcap']
            });
            propertiesContainer.appendChild(typeRow);
            
            // Color picker
            const colorRow = createPropertyRow('Color', 'color', 'color', props.color);
            propertiesContainer.appendChild(colorRow);
            
            // Standard properties
            if (['standard', 'physical'].includes(props.type)) {
                const metalnessRow = createPropertyRow('Metalness', 'range', 'metalness', props.metalness, { min: 0, max: 1, step: 0.01 });
                const roughnessRow = createPropertyRow('Roughness', 'range', 'roughness', props.roughness, { min: 0, max: 1, step: 0.01 });
                
                propertiesContainer.appendChild(metalnessRow);
                propertiesContainer.appendChild(roughnessRow);
            }
            
            // Physical material specific properties
            if (props.type === 'physical') {
                if (props.clearcoat !== undefined) {
                    const clearcoatRow = createPropertyRow('Clearcoat', 'range', 'clearcoat', props.clearcoat, { min: 0, max: 1, step: 0.01 });
                    propertiesContainer.appendChild(clearcoatRow);
                }
                
                if (props.clearcoatRoughness !== undefined) {
                    const clearcoatRoughnessRow = createPropertyRow('Clearcoat Roughness', 'range', 'clearcoatRoughness', props.clearcoatRoughness, { min: 0, max: 1, step: 0.01 });
                    propertiesContainer.appendChild(clearcoatRoughnessRow);
                }
                
                if (props.transmission !== undefined) {
                    const transmissionRow = createPropertyRow('Transmission', 'range', 'transmission', props.transmission, { min: 0, max: 1, step: 0.01 });
                    propertiesContainer.appendChild(transmissionRow);
                }
                
                if (props.ior !== undefined) {
                    const iorRow = createPropertyRow('IOR', 'range', 'ior', props.ior, { min: 1, max: 2.333, step: 0.01 });
                    propertiesContainer.appendChild(iorRow);
                }
            }
            
            // Emissive properties
            if (props.emissive !== undefined) {
                const emissiveRow = createPropertyRow('Emissive Color', 'color', 'emissive', props.emissive);
                const emissiveIntensityRow = createPropertyRow('Emissive Intensity', 'range', 'emissiveIntensity', props.emissiveIntensity, { min: 0, max: 2, step: 0.01 });
                
                propertiesContainer.appendChild(emissiveRow);
                propertiesContainer.appendChild(emissiveIntensityRow);
            }
            
            // Transparency properties
            const transparentRow = createPropertyRow('Transparent', 'checkbox', 'transparent', props.transparent);
            const opacityRow = createPropertyRow('Opacity', 'range', 'opacity', props.opacity, { min: 0, max: 1, step: 0.01 });
            
            propertiesContainer.appendChild(transparentRow);
            propertiesContainer.appendChild(opacityRow);
            
            // Texture section
            const textureSection = document.createElement('div');
            textureSection.className = 'texture-section';
            textureSection.innerHTML = '<h5>Textures</h5>';
            
            // Add texture buttons
            const textureTypes = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];
            
            textureTypes.forEach(type => {
                const textureRow = document.createElement('div');
                textureRow.className = 'property-row';
                
                const nameFormat = type.replace('Map', ' Map');
                const displayName = nameFormat.charAt(0).toUpperCase() + nameFormat.slice(1);
                
                textureRow.innerHTML = `
                    <div class="property-label">${displayName}</div>
                    <div class="property-value">
                        <button class="texture-btn" data-texture="${type}">Select Texture</button>
                    </div>
                `;
                
                textureSection.appendChild(textureRow);
            });
            
            propertiesContainer.appendChild(textureSection);
        };
        
        // Helper to create property row
        function createPropertyRow(label, type, name, value, options = {}) {
            const row = document.createElement('div');
            row.className = 'property-row';
            
            const labelEl = document.createElement('div');
            labelEl.className = 'property-label';
            labelEl.textContent = label;
            
            const valueEl = document.createElement('div');
            valueEl.className = 'property-value';
            
            let input;
            
            switch (type) {
                case 'color':
                    input = document.createElement('input');
                    input.type = 'color';
                    input.value = value;
                    input.name = name;
                    break;
                    
                case 'range':
                    input = document.createElement('input');
                    input.type = 'range';
                    input.min = options.min || 0;
                    input.max = options.max || 1;
                    input.step = options.step || 0.01;
                    input.value = value;
                    input.name = name;
                    
                    // Add value display
                    const valueDisplay = document.createElement('span');
                    valueDisplay.className = 'range-value';
                    valueDisplay.textContent = value;
                    
                    input.addEventListener('input', () => {
                        valueDisplay.textContent = input.value;
                    });
                    
                    valueEl.appendChild(input);
                    valueEl.appendChild(valueDisplay);
                    break;
                    
                case 'checkbox':
                    input = document.createElement('input');
                    input.type = 'checkbox';
                    input.checked = value;
                    input.name = name;
                    break;
                    
                case 'select':
                    input = document.createElement('select');
                    input.name = name;
                    
                    if (options.options) {
                        options.options.forEach(option => {
                            const opt = document.createElement('option');
                            opt.value = option;
                            opt.textContent = option.charAt(0).toUpperCase() + option.slice(1);
                            opt.selected = option === value;
                            input.appendChild(opt);
                        });
                    }
                    break;
                    
                default:
                    input = document.createElement('input');
                    input.type = 'text';
                    input.value = value;
                    input.name = name;
            }
            
            if (type !== 'range') {
                valueEl.appendChild(input);
            }
            
            row.appendChild(labelEl);
            row.appendChild(valueEl);
            
            return row;
        }
        
        propertiesEditor.appendChild(propertiesContainer);
        
        // Material preview (will show a sphere with the material)
        const previewContainer = document.createElement('div');
        previewContainer.className = 'material-preview';
        
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        previewContainer.appendChild(canvas);
        
        let preview;
        
        // Function to create preview renderer
        const createPreviewRenderer = () => {
            const width = canvas.width;
            const height = canvas.height;
            
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
            renderer.setSize(width, height);
            
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x333333);
            
            const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
            camera.position.z = 2;
            
            // Create preview mesh
            const geometry = new THREE.SphereGeometry(0.8, 32, 32);
            
            // Start with a basic material
            const material = new THREE.MeshStandardMaterial({ color: 0x4b80ff });
            
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            
            // Add lights
            const light = new THREE.DirectionalLight(0xffffff, 1);
            light.position.set(0, 1, 1);
            scene.add(light);
            
            scene.add(new THREE.AmbientLight(0x404040));
            
            // Render function
            const render = () => {
                mesh.rotation.y += 0.01;
                renderer.render(scene, camera);
                requestAnimationFrame(render);
            };
            
            render();
            
            return { renderer, scene, camera, mesh, material };
        };
        
        // Buttons container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'script-editor-buttons';
        
        // Preview button
        const previewBtn = document.createElement('button');
        previewBtn.textContent = 'Preview Material';
        previewBtn.className = 'script-editor-button';
        previewBtn.addEventListener('click', () => {
            try {
                // Initialize preview if not already created
                if (!preview) {
                    preview = createPreviewRenderer();
                    previewContainer.style.display = 'block';
                }
                
                // Get material properties from UI
                const properties = getMaterialPropertiesFromUI();
                
                // Update preview material
                Object.assign(preview.material, properties);
                
                // Handle special properties
                if (properties.color) {
                    preview.material.color.set(properties.color);
                }
                
                if (properties.emissive) {
                    preview.material.emissive.set(properties.emissive);
                }
                
                preview.material.needsUpdate = true;
            } catch (error) {
                alert('Error previewing material: ' + error.message);
                console.error('Error previewing material:', error);
            }
        });
        
        // Apply button
        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply Material';
        applyBtn.className = 'script-editor-button';
        applyBtn.addEventListener('click', () => {
            try {
                // Get material properties from UI
                const properties = getMaterialPropertiesFromUI();
                
                // Get selected preset
                const selectedPreset = document.querySelector('.preset-item.active');
                const presetName = selectedPreset ? selectedPreset.dataset.preset : null;
                
                // Create material
                let material;
                
                if (presetName) {
                    // Create from preset with overrides
                    material = this.engine.materialSystem.createMaterialFromPreset(presetName, properties);
                } else {
                    // Create from properties directly
                    material = this.engine.materialSystem.createMaterial(properties.type || 'standard', properties);
                }
                
                // Apply to object
                if (obj.object3D) {
                    // Store original material
                    obj.originalMaterial = obj.object3D.material;
                    
                    // Apply new material
                    obj.object3D.material = material;
                    
                    alert('Material applied successfully!');
                    
                    // Close modal
                    document.body.removeChild(modal);
                }
            } catch (error) {
                alert('Error applying material: ' + error.message);
                console.error('Error applying material:', error);
            }
        });
        
        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Material';
        saveBtn.className = 'script-editor-button script-editor-save';
        saveBtn.addEventListener('click', () => {
            const materialName = prompt('Enter a name for this material:', obj.name + '_Material');
            if (materialName) {
                try {
                    // Get material properties from UI
                    const properties = getMaterialPropertiesFromUI();
                    
                    // Register material preset
                    this.engine.materialSystem.registerMaterialPreset(materialName, properties);
                    
                    alert(`Material "${materialName}" saved as preset`);
                } catch (error) {
                    alert('Error saving material: ' + error.message);
                    console.error('Error saving material:', error);
                }
            }
        });
        
        // Helper to get material properties from UI
        function getMaterialPropertiesFromUI() {
            const properties = {};
            
            // Get all inputs
            const inputs = propertiesContainer.querySelectorAll('input, select');
            
            inputs.forEach(input => {
                if (!input.name) return;
                
                let value;
                
                if (input.type === 'checkbox') {
                    value = input.checked;
                } else if (input.type === 'number' || input.type === 'range') {
                    value = parseFloat(input.value);
                } else {
                    value = input.value;
                }
                
                properties[input.name] = value;
            });
            
            return properties;
        }
        
        // Add buttons to container
        buttonContainer.appendChild(previewBtn);
        buttonContainer.appendChild(applyBtn);
        buttonContainer.appendChild(saveBtn);
        
        // CSS for material editor
        const style = document.createElement('style');
        style.textContent = `
            .material-presets, .material-properties {
                max-height: 300px;
                overflow: auto;
                padding: 10px;
                background-color: #333;
                margin-bottom: 10px;
                border-radius: 5px;
            }
            
            .presets-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin-top: 10px;
            }
            
            .preset-item {
                background-color: #444;
                border-radius: 5px;
                padding: 10px;
                text-align: center;
                cursor: pointer;
                transition: transform 0.1s, background-color 0.2s;
            }
            
            .preset-item:hover {
                transform: translateY(-2px);
                background-color: #555;
            }
            
            .preset-item.active {
                background-color: #4b80ff;
            }
            
            .preset-preview {
                width: 50px;
                height: 50px;
                border-radius: 50%;
                margin: 0 auto 5px;
            }
            
            /* Preview colors for each preset */
            .metal-preview { background: linear-gradient(135deg, #8c8c8c, #aaa); }
            .plastic-preview { background: linear-gradient(135deg, #f0f0f0, #ddd); }
            .glass-preview { background: rgba(200, 200, 255, 0.5); border: 1px solid #fff; }
            .wood-preview { background: linear-gradient(135deg, #a06235, #7c4b1a); }
            .clay-preview { background: #f5d1b8; }
            .emissive-preview { background: #fff; box-shadow: 0 0 10px 2px rgba(255,255,255,0.8); }
            .water-preview { background: linear-gradient(135deg, #2389da, #0d5d94); }
            .matcap-preview { background: radial-gradient(#fff, #888); }
            
            .preset-name {
                font-weight: 500;
                text-transform: capitalize;
            }
            
            .properties-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .property-row {
                display: flex;
                align-items: center;
            }
            
            .property-label {
                width: 120px;
                font-weight: 500;
            }
            
            .property-value {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .property-value input[type="range"] {
                flex: 1;
            }
            
            .range-value {
                width: 40px;
                text-align: right;
            }
            
            .texture-section {
                margin-top: 10px;
                border-top: 1px solid #555;
                padding-top: 10px;
            }
            
            .texture-btn {
                background-color: #555;
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 3px;
                cursor: pointer;
            }
            
            .material-preview {
                margin-top: 10px;
                text-align: center;
                display: none;
            }
            
            .material-preview canvas {
                background-color: #333;
                border-radius: 5px;
            }
        `;
        
        document.head.appendChild(style);
        
        // Build modal
        materialContent.appendChild(header);
        materialContent.appendChild(presetsList);
        materialContent.appendChild(propertiesEditor);
        materialContent.appendChild(previewContainer);
        materialContent.appendChild(buttonContainer);
        modal.appendChild(materialContent);
        
        // Add to body
        document.body.appendChild(modal);
        
        // Set initial material UI
        updateMaterialPropertiesUI('metal');
        
        // Set first preset as active
        const firstPreset = document.querySelector('.preset-item');
        if (firstPreset) {
            firstPreset.classList.add('active');
        }
    }
}

export default EngineUI;