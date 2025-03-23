// Input handling system for game engine
import * as THREE from 'three';

export class InputSystem {
    constructor(engine) {
        this.engine = engine;
        
        // Track keyboard state
        this.keys = {};
        this.keyDown = {};
        this.keyUp = {};
        
        // Track mouse state
        this.mousePosition = { x: 0, y: 0 };
        this.mouseWorldPosition = new THREE.Vector3();
        this.mouseButtons = { left: false, middle: false, right: false };
        this.mouseButtonsDown = { left: false, middle: false, right: false };
        this.mouseButtonsUp = { left: false, middle: false, right: false };
        this.mouseWheelDelta = 0;
        
        // Touch support
        this.touches = [];
        this.touchesDown = [];
        this.touchesUp = [];
        
        // Gamepad support
        this.gamepads = {};
        this.gamepadButtonsDown = {};
        this.gamepadButtonsUp = {};
        
        // Initialize event listeners
        this.initKeyboardEvents();
        this.initMouseEvents();
        this.initTouchEvents();
        this.initGamepadEvents();
    }
    
    initKeyboardEvents() {
        window.addEventListener('keydown', (event) => {
            if (!this.keys[event.code]) {
                this.keyDown[event.code] = true;
            }
            this.keys[event.code] = true;
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('keydown', { code: event.code, key: event.key });
            }
        });
        
        window.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
            this.keyUp[event.code] = true;
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('keyup', { code: event.code, key: event.key });
            }
        });
    }
    
    initMouseEvents() {
        const viewport = document.getElementById('viewport');
        
        viewport.addEventListener('mousemove', (event) => {
            const rect = viewport.getBoundingClientRect();
            this.mousePosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mousePosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // Calculate world position using raycasting
            this.updateMouseWorldPosition();
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('mousemove', { 
                    position: {...this.mousePosition},
                    worldPosition: this.mouseWorldPosition.clone()
                });
            }
        });
        
        viewport.addEventListener('mousedown', (event) => {
            const button = this.getMouseButtonName(event.button);
            this.mouseButtons[button] = true;
            this.mouseButtonsDown[button] = true;
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('mousedown', { button });
            }
        });
        
        viewport.addEventListener('mouseup', (event) => {
            const button = this.getMouseButtonName(event.button);
            this.mouseButtons[button] = false;
            this.mouseButtonsUp[button] = true;
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('mouseup', { button });
            }
        });
        
        viewport.addEventListener('wheel', (event) => {
            this.mouseWheelDelta = Math.sign(event.deltaY);
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('mousewheel', { delta: this.mouseWheelDelta });
            }
        });
    }
    
    initTouchEvents() {
        const viewport = document.getElementById('viewport');
        
        viewport.addEventListener('touchstart', (event) => {
            const touches = Array.from(event.touches).map(touch => this.createTouchData(touch, viewport));
            this.touches = touches;
            this.touchesDown = [...touches];
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('touchstart', { touches: [...touches] });
            }
        });
        
        viewport.addEventListener('touchmove', (event) => {
            const touches = Array.from(event.touches).map(touch => this.createTouchData(touch, viewport));
            this.touches = touches;
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('touchmove', { touches: [...touches] });
            }
        });
        
        viewport.addEventListener('touchend', (event) => {
            const endedTouches = this.touches.filter(t => 
                !Array.from(event.touches).some(nt => nt.identifier === t.id)
            );
            this.touchesUp = [...endedTouches];
            const touches = Array.from(event.touches).map(touch => this.createTouchData(touch, viewport));
            this.touches = touches;
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('touchend', { 
                    touches: [...touches],
                    endedTouches: [...endedTouches]
                });
            }
        });
    }
    
    initGamepadEvents() {
        // Poll for gamepads on animation frame
        window.addEventListener('gamepadconnected', (event) => {
            console.log("Gamepad connected:", event.gamepad.id);
            this.gamepads[event.gamepad.index] = event.gamepad;
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('gamepadconnected', { gamepad: event.gamepad });
            }
        });
        
        window.addEventListener('gamepaddisconnected', (event) => {
            console.log("Gamepad disconnected:", event.gamepad.id);
            delete this.gamepads[event.gamepad.index];
            
            // Dispatch to event system if playing
            if (this.engine.isPlaying) {
                this.engine.events.emit('gamepaddisconnected', { gamepad: event.gamepad });
            }
        });
    }
    
    updateMouseWorldPosition() {
        // Use raycaster to find mouse position in 3D space
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.mousePosition, this.engine.camera);
        
        // Raycast against all objects
        const intersects = raycaster.intersectObjects(this.engine.scene.children, true);
        
        if (intersects.length > 0) {
            this.mouseWorldPosition.copy(intersects[0].point);
        } else {
            // If no intersection, project to ground plane at y=0
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            raycaster.ray.intersectPlane(groundPlane, this.mouseWorldPosition);
        }
    }
    
    update() {
        // Poll gamepads
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                // Update gamepad state
                this.gamepads[gamepad.index] = gamepad;
                
                // Check for button changes
                if (!this.gamepadButtonsDown[gamepad.index]) {
                    this.gamepadButtonsDown[gamepad.index] = new Array(gamepad.buttons.length).fill(false);
                    this.gamepadButtonsUp[gamepad.index] = new Array(gamepad.buttons.length).fill(false);
                }
                
                for (let j = 0; j < gamepad.buttons.length; j++) {
                    const button = gamepad.buttons[j];
                    const wasPressed = this.gamepadButtonsDown[gamepad.index][j];
                    
                    if (button.pressed && !wasPressed) {
                        this.gamepadButtonsDown[gamepad.index][j] = true;
                        
                        // Dispatch to event system if playing
                        if (this.engine.isPlaying) {
                            this.engine.events.emit('gamepadbuttondown', { 
                                gamepad: gamepad.index, button: j, value: button.value 
                            });
                        }
                    } else if (!button.pressed && wasPressed) {
                        this.gamepadButtonsUp[gamepad.index][j] = true;
                        
                        // Dispatch to event system if playing
                        if (this.engine.isPlaying) {
                            this.engine.events.emit('gamepadbuttonup', { 
                                gamepad: gamepad.index, button: j, value: button.value 
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Reset one-frame input states at the end of the frame
    resetFrame() {
        // Reset keys
        this.keyDown = {};
        this.keyUp = {};
        
        // Reset mouse
        this.mouseButtonsDown = { left: false, middle: false, right: false };
        this.mouseButtonsUp = { left: false, middle: false, right: false };
        this.mouseWheelDelta = 0;
        
        // Reset touch
        this.touchesDown = [];
        this.touchesUp = [];
        
        // Reset gamepad
        for (const gamepadIndex in this.gamepadButtonsDown) {
            this.gamepadButtonsDown[gamepadIndex] = this.gamepadButtonsDown[gamepadIndex].map(() => false);
            this.gamepadButtonsUp[gamepadIndex] = this.gamepadButtonsUp[gamepadIndex].map(() => false);
        }
    }
    
    // Helper to get named mouse button
    getMouseButtonName(button) {
        switch (button) {
            case 0: return 'left';
            case 1: return 'middle';
            case 2: return 'right';
            default: return 'left';
        }
    }
    
    // Helper to create consistent touch data
    createTouchData(touch, element) {
        const rect = element.getBoundingClientRect();
        const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        
        return {
            id: touch.identifier,
            position: { x, y },
            clientX: touch.clientX,
            clientY: touch.clientY
        };
    }
    
    // API for checking input states
    isKeyPressed(keyCode) {
        return this.keys[keyCode] === true;
    }
    
    isKeyDown(keyCode) {
        return this.keyDown[keyCode] === true;
    }
    
    isKeyUp(keyCode) {
        return this.keyUp[keyCode] === true;
    }
    
    isMouseButtonPressed(button) {
        return this.mouseButtons[button] === true;
    }
    
    isMouseButtonDown(button) {
        return this.mouseButtonsDown[button] === true;
    }
    
    isMouseButtonUp(button) {
        return this.mouseButtonsUp[button] === true;
    }
    
    getGamepadAxisValue(gamepadIndex, axisIndex) {
        const gamepad = this.gamepads[gamepadIndex];
        if (gamepad && gamepad.axes && gamepad.axes[axisIndex] !== undefined) {
            // Apply deadzone
            const value = gamepad.axes[axisIndex];
            const deadzone = 0.1;
            return Math.abs(value) < deadzone ? 0 : value;
        }
        return 0;
    }
    
    isGamepadButtonPressed(gamepadIndex, buttonIndex) {
        const gamepad = this.gamepads[gamepadIndex];
        return gamepad && gamepad.buttons && gamepad.buttons[buttonIndex] && gamepad.buttons[buttonIndex].pressed;
    }
    
    isGamepadButtonDown(gamepadIndex, buttonIndex) {
        return this.gamepadButtonsDown[gamepadIndex] && this.gamepadButtonsDown[gamepadIndex][buttonIndex] === true;
    }
    
    isGamepadButtonUp(gamepadIndex, buttonIndex) {
        return this.gamepadButtonsUp[gamepadIndex] && this.gamepadButtonsUp[gamepadIndex][buttonIndex] === true;
    }
}