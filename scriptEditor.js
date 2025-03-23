import * as THREE from 'three';

export class ScriptEditor {
    constructor(engine) {
        this.engine = engine;
    }
    
    openScriptEditor(obj) {
        // Create modal for script editor
        const modal = document.createElement('div');
        modal.className = 'script-editor-modal';
        
        const scriptEditorContent = document.createElement('div');
        scriptEditorContent.className = 'script-editor-content';
        
        // Header
        const header = document.createElement('div');
        header.className = 'script-editor-header';
        header.innerHTML = `<h3>Script Editor - ${obj.name}</h3>`;
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'script-editor-close';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        header.appendChild(closeBtn);
        
        // Info banner with documentation
        const infoBanner = document.createElement('div');
        infoBanner.className = 'script-editor-info';
        infoBanner.innerHTML = `
            <p>Write your object script here. Your script has access to:</p>
            <ul>
                <li><code>this.object</code> - Reference to the full object</li>
                <li><code>this.transform</code> - The Three.js object (position, rotation, etc.)</li>
                <li><code>this.engine</code> - Reference to the game engine</li>
                <li><code>this.scene</code> - Reference to the Three.js scene</li>
            </ul>
            <p>Lifecycle hooks available:</p>
            <ul>
                <li><code>awake()</code> - Called when the script is first initialized</li>
                <li><code>start()</code> - Called before the first update</li>
                <li><code>update(deltaTime)</code> - Called every frame</li>
                <li><code>lateUpdate(deltaTime)</code> - Called after all updates</li>
                <li><code>onEnable()</code> - Called when script is enabled</li>
                <li><code>onDisable()</code> - Called when script is disabled</li>
            </ul>
            <p>Advanced features:</p>
            <ul>
                <li><code>setProperty(key, value)</code>/<code>getProperty(key, defaultValue)</code> - Serializable properties</li>
                <li><code>startCoroutine(function*)</code> - Start coroutine (generator function)</li>
                <li><code>findChild(name)</code>/<code>getChildren()</code> - Hierarchy traversal</li>
                <li><code>instantiate(prefabName, position, rotation)</code> - Create prefab instances</li>
            </ul>
        `;
        
        // Text area for script
        const scriptArea = document.createElement('textarea');
        scriptArea.className = 'script-editor-textarea';
        
        // If the object already has a script, load it
        if (obj.script) {
            scriptArea.value = obj.script;
        } else {
            // Default template
            scriptArea.value = `// Script for ${obj.name}

// Called once when script is initialized
awake() {
    console.log("${obj.name} awake");
    
    // Store serializable properties
    this.setProperty('rotationSpeed', 1.0);
    this.setProperty('bobHeight', 0.5);
    
    // Subscribe to events
    this.on('game:levelComplete', this.onLevelComplete);
    
    // Add tags for querying
    this.addTag('interactive');
}

// Called once when play mode begins
start() {
    console.log("${obj.name} started");
    
    // Read serialized properties
    this.rotationSpeed = this.getProperty('rotationSpeed', 1.0);
    this.bobHeight = this.getProperty('bobHeight', 0.5);
    
    // Example of a simple coroutine
    this.startCoroutine(this.bobUpAndDown());
    
    // Find other objects with the same script
    const similarObjects = this.findObjectsByScript(this.scriptName);
    console.log(\`Found \${similarObjects.length} objects with this script\`);
    
    // Find objects by tag
    const interactiveObjects = this.findObjectsByTag('interactive');
    console.log(\`Found \${interactiveObjects.length} interactive objects\`);
}

// Coroutine example that makes object bob up and down
*bobUpAndDown() {
    const startY = this.transform.position.y;
    while(true) {
        // Each yield returns control to the engine until next frame
        const time = yield;
        this.transform.position.y = startY + Math.sin(performance.now() / 1000) * this.bobHeight;
    }
}

// Called when a level is completed
onLevelComplete(data) {
    console.log("Level completed with score:", data.score);
}

// Called every frame during play mode
// deltaTime is seconds since last frame
update(deltaTime) {
    // Input handling example
    if (this.isKeyPressed('Space')) {
        // Space key is currently held down
        this.transform.position.y += 5 * deltaTime;
    }
    
    if (this.isKeyDown('KeyR')) {
        // R key was just pressed this frame
        this.emit('game:objectReset', { object: this.object });
    }
    
    // Mouse input example
    if (this.isMouseButtonDown('left')) {
        // Left mouse button was just clicked
        const mousePos = this.getMouseWorldPosition();
        console.log("Mouse clicked at world position:", mousePos);
    }
    
    // Example: rotate object
    this.transform.rotation.y += this.rotationSpeed * deltaTime;
}

// Called after all updates are processed
lateUpdate(deltaTime) {
    // Example: ensure object always faces the camera
    // this.transform.lookAt(this.engine.camera.position);
}

// Example of finding child objects and traversing hierarchy
doSomethingWithChildren() {
    const children = this.getChildren();
    children.forEach(child => {
        console.log(\`Found child: \${child.name}\`);
    });
    
    // Find specific child
    const targetChild = this.findChild("SpecificChildName");
    if (targetChild) {
        console.log("Found target child!");
    }
}

// Called when script is enabled
onEnable() {
    console.log("${obj.name} script enabled");
}

// Called when script is disabled
onDisable() {
    console.log("${obj.name} script disabled");
    
    // Clean up any event listeners explicitly (though this happens automatically too)
    this.off('game:levelComplete', this.onLevelComplete);
}`;
        }
        
        // Buttons container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'script-editor-buttons';
        
        // Test button
        const testBtn = document.createElement('button');
        testBtn.textContent = 'Test Script';
        testBtn.className = 'script-editor-button';
        testBtn.addEventListener('click', () => {
            // Use the scripting system to validate the syntax
            try {
                const result = this.engine.scriptingSystem.validateScript(scriptArea.value);
                if (result.valid) {
                    alert('Script syntax is valid!');
                } else {
                    alert(`Script error: ${result.error}`);
                }
            } catch (error) {
                console.error("Script validation error:", error);
                alert(`Script validation error: ${error.message || "Unknown error"}`);
            }
        });
        
        // Create a reload button
        const reloadBtn = document.createElement('button');
        reloadBtn.textContent = 'Hot Reload';
        reloadBtn.className = 'script-editor-button';
        reloadBtn.addEventListener('click', () => {
            // Save the script
            obj.script = scriptArea.value;
            
            // If already playing, reload the script - preserving properties
            if (this.engine.isPlaying && obj.scriptInstance) {
                const success = this.engine.scriptingSystem.hotReloadScript(obj);
                
                if (success) {
                    alert('Script hot-reloaded!');
                } else {
                    alert('Error hot-reloading script. Check console for details.');
                }
            } else {
                alert('Script saved! It will be loaded when play mode starts.');
            }
            
            // Tell UI to update
            const event = new CustomEvent('script-updated', { 
                detail: { object: obj } 
            });
            document.dispatchEvent(event);
        });
        
        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Script';
        saveBtn.className = 'script-editor-button script-editor-save';
        saveBtn.addEventListener('click', () => {
            obj.script = scriptArea.value;
            document.body.removeChild(modal);
            
            // Tell UI to update
            const event = new CustomEvent('script-updated', { 
                detail: { object: obj } 
            });
            document.dispatchEvent(event);
            
            alert('Script saved successfully');
        });
        
        // Add buttons to container
        buttonContainer.appendChild(testBtn);
        buttonContainer.appendChild(reloadBtn);
        buttonContainer.appendChild(saveBtn);
        
        // Build modal
        scriptEditorContent.appendChild(header);
        scriptEditorContent.appendChild(infoBanner);
        scriptEditorContent.appendChild(scriptArea);
        scriptEditorContent.appendChild(buttonContainer);
        modal.appendChild(scriptEditorContent);
        
        // Add to body
        document.body.appendChild(modal);
    }
}