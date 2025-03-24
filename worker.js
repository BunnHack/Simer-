// Create a new worker.js file for background processing

// Define functions that can be called from main thread
const tasks = {
    // Expensive physics simulation
    simulateParticles: function(data) {
        const { particles, timeStep, iterations } = data;
        const result = [];
        
        // Simulate particle physics (sample implementation)
        for (let i = 0; i < iterations; i++) {
            for (let j = 0; j < particles.length; j++) {
                const p = particles[j];
                
                // Update position based on velocity
                p.x += p.vx * timeStep;
                p.y += p.vy * timeStep;
                p.z += p.vz * timeStep;
                
                // Apply gravity
                p.vy -= 9.8 * timeStep;
                
                // Simple collision with ground
                if (p.y < 0) {
                    p.y = 0;
                    p.vy = -p.vy * 0.8; // Bounce with energy loss
                }
                
                // Store updated particle
                result[j] = { ...p };
            }
        }
        
        return result;
    },
    
    // Pathfinding calculation
    findPath: function(data) {
        const { grid, start, end } = data;
        
        // A* pathfinding implementation
        const openSet = [start];
        const closedSet = [];
        const cameFrom = {};
        
        const gScore = {};
        gScore[`${start.x},${start.y}`] = 0;
        
        const fScore = {};
        fScore[`${start.x},${start.y}`] = heuristic(start, end);
        
        while (openSet.length > 0) {
            // Find node with lowest fScore
            let current = openSet[0];
            let lowestScore = fScore[`${current.x},${current.y}`];
            let currentIndex = 0;
            
            for (let i = 1; i < openSet.length; i++) {
                const node = openSet[i];
                const score = fScore[`${node.x},${node.y}`];
                if (score < lowestScore) {
                    lowestScore = score;
                    current = node;
                    currentIndex = i;
                }
            }
            
            // Check if we reached the end
            if (current.x === end.x && current.y === end.y) {
                // Reconstruct path
                const path = [];
                let curr = current;
                while (cameFrom[`${curr.x},${curr.y}`]) {
                    path.unshift(curr);
                    curr = cameFrom[`${curr.x},${curr.y}`];
                }
                path.unshift(start);
                return path;
            }
            
            // Remove current from openSet and add to closedSet
            openSet.splice(currentIndex, 1);
            closedSet.push(current);
            
            // Check neighbors
            const neighbors = getNeighbors(current, grid);
            for (const neighbor of neighbors) {
                const nKey = `${neighbor.x},${neighbor.y}`;
                
                // Skip if already evaluated
                if (closedSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                    continue;
                }
                
                // Calculate tentative gScore
                const tentativeGScore = (gScore[`${current.x},${current.y}`] || Infinity) + 1;
                
                // Add to open set if not there
                if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                    openSet.push(neighbor);
                } else if (tentativeGScore >= (gScore[nKey] || Infinity)) {
                    continue;
                }
                
                // This path is better, record it
                cameFrom[nKey] = current;
                gScore[nKey] = tentativeGScore;
                fScore[nKey] = gScore[nKey] + heuristic(neighbor, end);
            }
        }
        
        // No path found
        return [];
        
        // Helper functions
        function heuristic(a, b) {
            // Manhattan distance
            return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        }
        
        function getNeighbors(node, grid) {
            const neighbors = [];
            const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
            
            for (const [dx, dy] of dirs) {
                const x = node.x + dx;
                const y = node.y + dy;
                
                // Check bounds and walkability
                if (x >= 0 && x < grid.length && 
                    y >= 0 && y < grid[0].length && 
                    grid[x][y] === 0) { // 0 means walkable
                    neighbors.push({x, y});
                }
            }
            
            return neighbors;
        }
    },
    
    // Procedural terrain generation
    generateTerrain: function(data) {
        const { width, height, scale, octaves, persistence, lacunarity, seed } = data;
        const result = new Array(width * height);
        
        // Simple noise-based terrain generation
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let amplitude = 1;
                let frequency = 1;
                let noiseHeight = 0;
                
                // Generate multiple octaves of noise
                for (let i = 0; i < octaves; i++) {
                    const sampleX = x / scale * frequency + seed;
                    const sampleY = y / scale * frequency + seed;
                    
                    // Simple 2D noise (normally would use a proper noise function)
                    const noise = Math.sin(sampleX * 12.9898 + sampleY * 78.233) * 43758.5453 % 1;
                    noiseHeight += noise * amplitude;
                    
                    amplitude *= persistence;
                    frequency *= lacunarity;
                }
                
                result[y * width + x] = noiseHeight;
            }
        }
        
        return result;
    }
};

// Handle messages from main thread
self.onmessage = function(event) {
    const { taskId, task, data } = event.data;
    
    try {
        // Check if task exists
        if (!tasks[task]) {
            throw new Error(`Unknown task: ${task}`);
        }
        
        // Execute the task and return result
        const result = tasks[task](data);
        self.postMessage({ taskId, result });
    } catch (error) {
        self.postMessage({ taskId, error: error.message });
    }
};
