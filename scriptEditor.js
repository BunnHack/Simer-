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
        header.innerHTML = `<h3>Script Editor - ${obj.name}.js</h3>`;
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.className = 'script-editor-close';
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        header.appendChild(closeBtn);
        
        // Create code editor with syntax highlighting (using pre and code tags instead of textarea)
        const editorContainer = document.createElement('div');
        editorContainer.className = 'script-editor-container';
        
        // Include highlight.js library
        if (!document.getElementById('highlightjs-css')) {
            const highlightCSS = document.createElement('link');
            highlightCSS.id = 'highlightjs-css';
            highlightCSS.rel = 'stylesheet';
            highlightCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/atom-one-dark.min.css';
            document.head.appendChild(highlightCSS);
            
            const highlightJS = document.createElement('script');
            highlightJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js';
            document.head.appendChild(highlightJS);
        }
        
        // Create editable code element
        const codeEditor = document.createElement('div');
        codeEditor.className = 'code-editor';
        codeEditor.contentEditable = 'true';
        codeEditor.spellcheck = false;
        
        // Improve code editor behavior
        codeEditor.addEventListener('keydown', (e) => {
            // Preserve tab keypresses for indentation
            if (e.key === 'Tab') {
                e.preventDefault();
                document.execCommand('insertHTML', false, '    ');
            }
            
            // Ensure proper handling of Enter key
            if (e.key === 'Enter') {
                e.preventDefault();
                document.execCommand('insertLineBreak');
                return false;
            }
        });
        
        // Prevent keyboard from closing on mobile
        codeEditor.addEventListener('blur', (e) => {
            // Prevent losing focus on mobile
            if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
                e.preventDefault();
                setTimeout(() => codeEditor.focus(), 100);
            }
        });
        
        // Prevent div wrapping from causing odd behavior
        codeEditor.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.originalEvent || e).clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });
        
        // Set initial content
        if (obj.script) {
            codeEditor.textContent = obj.script;
        } else {
            // Default template
            codeEditor.textContent = `// Script for ${obj.name}

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
        
        editorContainer.appendChild(codeEditor);
        
        // Initialize syntax highlighting after a short delay
        setTimeout(() => {
            if (window.hljs) {
                // Add JavaScript class for highlighting
                codeEditor.className = 'code-editor language-javascript';
                window.hljs.highlightElement(codeEditor);
                
                // Handle content changes and rehighlight
                codeEditor.addEventListener('input', () => {
                    // Store cursor position
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    const offset = range.startOffset;
                    const node = range.startContainer;
                    
                    // Re-highlight on content change
                    if (window.hljs) {
                        window.hljs.highlightElement(codeEditor);
                    }
                    
                    // Restore cursor position after highlighting
                    try {
                        setTimeout(() => {
                            selection.removeAllRanges();
                            const newRange = document.createRange();
                            newRange.setStart(node, offset);
                            newRange.setEnd(node, offset);
                            selection.addRange(newRange);
                        }, 0);
                    } catch (e) {
                        // Fall back if exact position can't be restored
                        codeEditor.focus();
                    }
                });
            }
        }, 500);
        
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
                const scriptContent = codeEditor.textContent || '';
                const result = this.engine.scriptingSystem.validateScript(scriptContent);
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
            obj.script = codeEditor.textContent || '';
            
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
            obj.script = codeEditor.textContent || '';
            obj.scriptFileName = `${obj.name}.js`;
            document.body.removeChild(modal);
            
            // Tell UI to update
            const event = new CustomEvent('script-updated', { 
                detail: { object: obj } 
            });
            document.dispatchEvent(event);
            
            // Offer to download the script file
            const blob = new Blob([obj.script], {type: 'text/javascript'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = obj.scriptFileName;
            a.click();
            URL.revokeObjectURL(url);
            
            alert('Script saved successfully');
        });
        
        // Add buttons to container
        buttonContainer.appendChild(testBtn);
        buttonContainer.appendChild(reloadBtn);
        buttonContainer.appendChild(saveBtn);
        
        // Build modal
        scriptEditorContent.appendChild(header);
        scriptEditorContent.appendChild(editorContainer);
        scriptEditorContent.appendChild(buttonContainer);
        modal.appendChild(scriptEditorContent);
        
        // Add to body
        document.body.appendChild(modal);
    }
}