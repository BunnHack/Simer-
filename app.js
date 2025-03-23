import GameEngine from './engine.js';
import EngineUI from './ui.js';

// Initialize the engine
const engine = new GameEngine();

// Initialize the UI
const ui = new EngineUI(engine);

// Add initial objects
// Uncomment these lines to have objects at startup
// engine.addCube();
// engine.addSphere();

console.log('Three.js Game Engine UI initialized');

