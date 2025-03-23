// Game Engine Configuration
export const config = {
    // Rendering settings
    renderer: {
        antialias: true,
        shadowMap: true,
        clearColor: '#222222',
        // Advanced rendering settings
        physicallyCorrectLights: true,
        outputEncoding: 'sRGB',
        toneMapping: 'ACESFilmic'
    },
    
    // Post-processing settings
    postProcessing: {
        enabled: false,
        passes: ['bloom', 'dof']
    },
    
    // Camera settings
    camera: {
        fov: 75,
        near: 0.1,
        far: 1000,
        position: { x: 3, y: 3, z: 5 }
    },
    
    // Editor settings
    editor: {
        gridSize: 10,
        gridDivisions: 10,
        showAxesHelper: true,
        defaultObjectColor: '#4b80ff'
    },
    
    // Physics settings
    physics: {
        gravity: -9.8,
        enabled: true
    },
    
    // Default light settings
    defaultLight: {
        color: '#ffffff',
        intensity: 1,
        position: { x: 5, y: 5, z: 5 }
    }
};