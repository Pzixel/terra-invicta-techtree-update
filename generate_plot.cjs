const fs = require('fs');
const d3 = require('d3');
const { createCanvas } = require('canvas');

// Load data
const data = JSON.parse(fs.readFileSync('drive_data.json', 'utf8'));

// Canvas setup
const width = 1200*1.3;
const height = 800*1.3;
const margin = { top: 60, right: 250, bottom: 100, left: 120 };
const canvas = createCanvas(width, height);
const context = canvas.getContext('2d');

// White background
context.fillStyle = 'white';
context.fillRect(0, 0, width, height);

// Prepare dataset
const plotData = [];
Object.entries(data.categories).forEach(([categoryKey, category]) => {
  category.drives.forEach(drive => {
    plotData.push({
      name: drive.name,
      category: categoryKey,
      displayCategory: category.displayName,
      color: data.colorMap[categoryKey] || category.color,
      ev: drive.ev,
      thrust: drive.thrust
    });
  });
});

// Set up scales
const xScale = d3.scaleLog()
  .domain([data.metadata.xAxis.min, data.metadata.xAxis.max])
  .range([margin.left, width - margin.right]);

const yScale = d3.scaleLog()
  .domain([data.metadata.yAxis.min, data.metadata.yAxis.max])
  .range([height - margin.bottom, margin.top]);

// Draw grid lines
const xGridLines = xScale.ticks(10);
const yGridLines = yScale.ticks(10);

context.strokeStyle = 'rgba(0, 0, 0, 0.1)';
context.lineWidth = 1;

// X and Y grid lines
xGridLines.forEach(tick => {
  const x = xScale(tick);
  context.beginPath();
  context.moveTo(x, margin.top);
  context.lineTo(x, height - margin.bottom);
  context.stroke();
});

yGridLines.forEach(tick => {
  const y = yScale(tick);
  context.beginPath();
  context.moveTo(margin.left, y);
  context.lineTo(width - margin.right, y);
  context.stroke();
});

// Draw axes
context.strokeStyle = 'black';
context.lineWidth = 2;

// X and Y axes
context.beginPath();
context.moveTo(margin.left, height - margin.bottom);
context.lineTo(width - margin.right, height - margin.bottom);
context.stroke();

context.beginPath();
context.moveTo(margin.left, margin.top);
context.lineTo(margin.left, height - margin.bottom);
context.stroke();

// X-axis ticks and labels
context.font = '12px Arial';
context.textAlign = 'center';
context.textBaseline = 'top';
context.fillStyle = 'black';

xGridLines.forEach(tick => {
  const x = xScale(tick);
  
  context.beginPath();
  context.moveTo(x, height - margin.bottom);
  context.lineTo(x, height - margin.bottom + 6);
  context.stroke();
  
  // Only show labels for powers of 10
  const logValue = Math.log10(tick);
  const isIntegerPowerOf10 = Math.abs(logValue - Math.round(logValue)) < 0.001;
  
  if (isIntegerPowerOf10) {
    // Format tick labels appropriately
    let label;
    if (tick < 1) {
      label = tick.toExponential(0);
    } else if (tick < 10) {
      label = tick.toFixed(1);
    } else if (tick < 1000) {
      label = tick.toFixed(0);
    } else {
      label = (tick / 1000) + 'k';
    }
    
    context.fillText(label, x, height - margin.bottom + 10);
  }
});

// Y-axis ticks and labels
context.textAlign = 'right';
context.textBaseline = 'middle';

yGridLines.forEach(tick => {
  const y = yScale(tick);
  
  context.beginPath();
  context.moveTo(margin.left, y);
  context.lineTo(margin.left - 6, y);
  context.stroke();
  
  // Only show labels for powers of 10
  const logValue = Math.log10(tick);
  const isIntegerPowerOf10 = Math.abs(logValue - Math.round(logValue)) < 0.001;
  
  if (isIntegerPowerOf10) {
    // Format tick labels appropriately
    let label;
    if (tick < 1) {
      label = tick.toExponential(0);
    } else if (tick < 10) {
      label = tick.toFixed(1);
    } else if (tick < 1000) {
      label = tick.toFixed(0);
    } else {
      label = (tick / 1000) + 'k';
    }
  
    context.fillText(label, margin.left - 10, y);
  }
});

// Axis labels and title
context.textAlign = 'center';
context.font = 'bold 14px Arial';

// X-axis label
context.textBaseline = 'bottom';
context.fillText(data.metadata.xAxis.label, (width - margin.right + margin.left) / 2, height - 20);

// Y-axis label
context.save();
context.translate(40, (height - margin.bottom + margin.top) / 2);
context.rotate(-Math.PI / 2);
context.fillText(data.metadata.yAxis.label, 0, 0);
context.restore();

// Chart title
context.textAlign = 'center';
context.textBaseline = 'top';
context.font = 'bold 18px Arial';
context.fillText('Terra Invicta Drive Chart - Thrust vs. Exhaust Velocity', width / 2, 20);
context.font = '14px Arial';
context.fillText('(Logarithmic Scale)', width / 2, 45);

// Draw the points first
plotData.forEach(drive => {
  const x = xScale(drive.ev);
  const y = yScale(drive.thrust);
  
  context.beginPath();
  context.arc(x, y, 4, 0, 2 * Math.PI);
  context.fillStyle = drive.color;
  context.fill();
  context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  context.lineWidth = 1;
  context.stroke();
});

// Prepare for label placement
const labelNodes = [];

// Measure text dimensions for all labels
context.font = '10px Arial';
plotData.forEach(drive => {
  const x = xScale(drive.ev);
  const y = yScale(drive.thrust);
  const textMetrics = context.measureText(drive.name);
  const textWidth = textMetrics.width;
  const textHeight = 12; // Approximate height for 10px font
  const padding = 3;

  labelNodes.push({
    drive,
    anchorX: x,
    anchorY: y,
    x: x, // Start at anchor position
    y: y, // Start at anchor position
    textWidth,
    textHeight,
    width: textWidth + 2 * padding,
    height: textHeight + 2 * padding,
    padding
  });
});

// Define the chart area boundaries
const chartArea = {
  x1: margin.left + 5,
  y1: margin.top + 5,
  x2: width - margin.right - 5,
  y2: height - margin.bottom - 5
};

// Generate stable positions with less randomness
// First sort by position to process nearby points together
labelNodes.sort((a, b) => {
  // Sort by grid position (divide space into a coarse grid)
  const gridSize = 50;
  const aGridX = Math.floor(a.anchorX / gridSize);
  const aGridY = Math.floor(a.anchorY / gridSize);
  const bGridX = Math.floor(b.anchorX / gridSize);
  const bGridY = Math.floor(b.anchorY / gridSize);
  
  if (aGridY !== bGridY) return aGridY - bGridY;
  return aGridX - bGridX;
});

// Candidate positions around a point (in preference order)
function getPositionCandidates(node) {
  const { anchorX, anchorY, width, height } = node;
  const radius = 10; // Initial distance from point
  const positions = [];
  
  // Try positions around the anchor in a spiral pattern
  // First try 8 compass directions at close distance
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    positions.push({
      x: anchorX + Math.cos(angle) * radius,
      y: anchorY + Math.sin(angle) * radius,
      distance: radius
    });
  }
  
  // Then try more positions in a growing spiral
  for (let r = radius * 1.5; r < radius * 5; r += radius / 2) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      positions.push({
        x: anchorX + Math.cos(angle) * r,
        y: anchorY + Math.sin(angle) * r,
        distance: r
      });
    }
  }
  
  return positions;
}

// Check if two rectangles overlap
function doRectanglesOverlap(rect1, rect2, tolerance = 0) {
  return !(
    rect1.right + tolerance < rect2.left ||
    rect2.right + tolerance < rect1.left ||
    rect1.bottom + tolerance < rect2.top ||
    rect2.bottom + tolerance < rect1.top
  );
}

// Place labels - this uses a physics-inspired approach where labels are allowed to overlap
// but with strong penalty, while maintaining a strong attraction to their anchor point
const placedLabels = [];

labelNodes.forEach(node => {
  // Create rectangle for collision detection
  function createRect(x, y, width, height) {
    return {
      left: x - width/2,
      right: x + width/2,
      top: y - height/2,
      bottom: y + height/2
    };
  }
  
  // Get candidate positions
  const candidates = getPositionCandidates(node);
  
  // Find the best position with minimal overlap
  let bestPosition = null;
  let bestOverlapArea = Infinity;
  
  for (const pos of candidates) {
    // Create rectangle for this position
    const rect = createRect(pos.x, pos.y, node.width, node.height);
    
    // Ensure position is within chart boundaries
    if (rect.left < chartArea.x1 || rect.right > chartArea.x2 || 
        rect.top < chartArea.y1 || rect.bottom > chartArea.y2) {
      continue;
    }
    
    // Calculate total overlap with existing labels
    let totalOverlapArea = 0;
    for (const placedLabel of placedLabels) {
      const placedRect = createRect(placedLabel.x, placedLabel.y, placedLabel.width, placedLabel.height);
      if (doRectanglesOverlap(rect, placedRect)) {
        // Calculate overlap area
        const overlapWidth = Math.min(rect.right, placedRect.right) - Math.max(rect.left, placedRect.left);
        const overlapHeight = Math.min(rect.bottom, placedRect.bottom) - Math.max(rect.top, placedRect.top);
        totalOverlapArea += overlapWidth * overlapHeight;
      }
    }
    
    // Factor in distance from anchor point
    const score = totalOverlapArea * 100 + pos.distance;
    
    if (score < bestOverlapArea) {
      bestOverlapArea = score;
      bestPosition = pos;
    }
    
    // If we found a position with no overlap, take it immediately
    if (totalOverlapArea === 0) {
      break;
    }
  }
  
  // Use the best position or fallback to anchor position if nothing works
  if (bestPosition) {
    node.x = bestPosition.x;
    node.y = bestPosition.y;
  }
  
  // Add this label to placed labels
  placedLabels.push(node);
});

// Use D3's force simulation for final adjustment
// This takes the initial placement and refines it
const simulation = d3.forceSimulation(labelNodes);

// Maximum distance a label can travel from its anchor point
const MAX_LABEL_DISTANCE = 70;

// Debug: Add safety checks for node positions before and after forces
function checkAndFixNodePosition(node) {
  // Make sure node has valid position
  if (isNaN(node.x) || isNaN(node.y)) {
    console.log("Found NaN position, resetting to anchor");
    node.x = node.anchorX;
    node.y = node.anchorY;
    node.vx = 0;
    node.vy = 0;
  }
  
  // Make sure node stays within chart area
  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;
  
  node.x = Math.max(chartArea.x1 + halfWidth, Math.min(node.x, chartArea.x2 - halfWidth));
  node.y = Math.max(chartArea.y1 + halfHeight, Math.min(node.y, chartArea.y2 - halfHeight));
  
  // Enforce maximum distance from anchor
  const dx = node.x - node.anchorX;
  const dy = node.y - node.anchorY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > MAX_LABEL_DISTANCE) {
    node.x = node.anchorX + (dx / distance) * MAX_LABEL_DISTANCE;
    node.y = node.anchorY + (dy / distance) * MAX_LABEL_DISTANCE;
  }
}

// Add D3's built-in forces with custom parameters
simulation
  // Collision detection - prevent overlapping
  .force('collision', d3.forceCollide().radius(d => 
    Math.sqrt(d.width * d.width + d.height * d.height) / 2 + 3 // Add padding
  ).strength(0.8).iterations(2))
  
  // X attraction to anchor point
  .force('x', d3.forceX().x(d => d.anchorX).strength(0.1))
  
  // Y attraction to anchor point
  .force('y', d3.forceY().y(d => d.anchorY).strength(0.1))
  
  // Centering force - keeps labels from drifting too far
  .force('center', d3.forceCenter(
    (chartArea.x1 + chartArea.x2) / 2,
    (chartArea.y1 + chartArea.y2) / 2
  ).strength(0.01))
  
  // Box force - keep labels within chart area
  .force('bounds', () => {
    const nodes = simulation.nodes();
    nodes.forEach(node => {
      const halfWidth = node.width / 2;
      const halfHeight = node.height / 2;
      
      if (node.x - halfWidth < chartArea.x1) node.vx += (chartArea.x1 - (node.x - halfWidth)) * 0.1;
      if (node.x + halfWidth > chartArea.x2) node.vx -= ((node.x + halfWidth) - chartArea.x2) * 0.1;
      if (node.y - halfHeight < chartArea.y1) node.vy += (chartArea.y1 - (node.y - halfHeight)) * 0.1;
      if (node.y + halfHeight > chartArea.y2) node.vy -= ((node.y + halfHeight) - chartArea.y2) * 0.1;
    });
  })
  
  // Add a custom force for label-specific behavior
  .force('custom', () => {
    // Apply additional custom behaviors
    const nodes = simulation.nodes();
    
    // First, check and fix any invalid positions
    nodes.forEach(node => {
      checkAndFixNodePosition(node);
    });
    
    // Apply radial distribution for clustered nodes
    const clusters = {};
    
    // Group nodes by nearby anchor points
    nodes.forEach(node => {
      // Use grid-based clustering - 30x30 grid cells
      const cellSize = 30;
      const cellX = Math.floor(node.anchorX / cellSize);
      const cellY = Math.floor(node.anchorY / cellSize);
      const cellId = `${cellX},${cellY}`;
      
      if (!clusters[cellId]) clusters[cellId] = [];
      clusters[cellId].push(node);
    });
    
    // Apply radial distribution to clusters
    Object.values(clusters).forEach(cluster => {
      if (cluster.length <= 2) return; // Skip small clusters
      
      // Find cluster center
      let centerX = 0, centerY = 0;
      cluster.forEach(node => {
        centerX += node.anchorX;
        centerY += node.anchorY;
      });
      centerX /= cluster.length;
      centerY /= cluster.length;
      
      // Distribute nodes in a circle around the center
      const radius = 20 + cluster.length * 2;
      const angleStep = (2 * Math.PI) / cluster.length;
      
      cluster.forEach((node, i) => {
        // Target position in a circle
        const angle = i * angleStep;
        const tx = centerX + radius * Math.cos(angle);
        const ty = centerY + radius * Math.sin(angle);
        
        // Push toward this position with a weak force
        const dx = tx - node.x;
        const dy = ty - node.y;
        node.vx += dx * 0.03;
        node.vy += dy * 0.03;
      });
    });
  });

// Fix positions after each tick
simulation.on('tick', () => {
  simulation.nodes().forEach(node => {
    checkAndFixNodePosition(node);
  });
});

// Run the simulation with enough iterations to settle
const ITERATIONS = 300;
for (let i = 0; i < ITERATIONS; i++) {
  simulation.tick();
}

// Check for overlapping labels and adjust if needed
function adjustOverlappingLabels() {
  const nodes = simulation.nodes();
  let hasOverlaps = true;
  let iterations = 0;
  
  // Try to resolve overlaps with additional iterations
  while (hasOverlaps && iterations < 100) {
    hasOverlaps = false;
    iterations++;
    
    // Create rectangles for all nodes
    const rects = nodes.map(node => ({
      node,
      left: node.x - node.width / 2,
      right: node.x + node.width / 2,
      top: node.y - node.height / 2,
      bottom: node.y + node.height / 2
    }));
    
    // Check for overlaps
    for (let i = 0; i < rects.length && !hasOverlaps; i++) {
      const rectA = rects[i];
      
      for (let j = i + 1; j < rects.length && !hasOverlaps; j++) {
        const rectB = rects[j];
        
        // Check if they overlap
        if (!(rectA.right < rectB.left || rectB.right < rectA.left ||
              rectA.bottom < rectB.top || rectB.bottom < rectA.top)) {
          // They overlap - mark flag and push them apart
          hasOverlaps = true;
          
          // Calculate centers and direction
          const centerAx = (rectA.left + rectA.right) / 2;
          const centerAy = (rectA.top + rectA.bottom) / 2;
          const centerBx = (rectB.left + rectB.right) / 2;
          const centerBy = (rectB.top + rectB.bottom) / 2;
          
          const dx = centerBx - centerAx;
          const dy = centerBy - centerAy;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = dx / dist;
          const ny = dy / dist;
          
          // Push apart
          rectA.node.x -= nx * 2;
          rectA.node.y -= ny * 2;
          rectB.node.x += nx * 2;
          rectB.node.y += ny * 2;
          
          // Re-check and fix positions
          checkAndFixNodePosition(rectA.node);
          checkAndFixNodePosition(rectB.node);
        }
      }
    }
  }
}

// Run final adjustment
adjustOverlappingLabels();

// Make sure all labels are visible by explicitly checking their positions
let allLabelsVisible = true;
simulation.nodes().forEach(node => {
  // Check if node is within chart area with a margin
  const visible = 
    node.x - node.width/2 >= chartArea.x1 - 5 &&
    node.x + node.width/2 <= chartArea.x2 + 5 &&
    node.y - node.height/2 >= chartArea.y1 - 5 &&
    node.y + node.height/2 <= chartArea.y2 + 5;
  
  if (!visible) {
    console.log(`Label "${node.drive.name}" is outside chart boundaries, repositioning`);
    // Place it near its anchor point but within boundaries
    node.x = Math.max(chartArea.x1 + node.width/2 + 5, 
                      Math.min(node.anchorX + 20, chartArea.x2 - node.width/2 - 5));
    node.y = Math.max(chartArea.y1 + node.height/2 + 5, 
                      Math.min(node.anchorY - 15, chartArea.y2 - node.height/2 - 5));
    allLabelsVisible = false;
  }
});

// If we had to adjust positions, run one more quick adjustment to prevent overlaps
if (!allLabelsVisible) {
  adjustOverlappingLabels();
}

// Add a refinement phase to move uncontested labels closer to their anchor points
function refineLabelPositions() {
  const nodes = simulation.nodes();
  
  // Sort nodes by distance from their anchor points (farthest first)
  nodes.sort((a, b) => {
    const distA = Math.sqrt(Math.pow(a.x - a.anchorX, 2) + Math.pow(a.y - a.anchorY, 2));
    const distB = Math.sqrt(Math.pow(b.x - b.anchorX, 2) + Math.pow(b.y - b.anchorY, 2));
    return distB - distA;
  });
  
  // Function to check if a label at a potential position would overlap any other labels
  function wouldOverlap(node, testX, testY) {
    const testRect = {
      left: testX - node.width / 2,
      right: testX + node.width / 2,
      top: testY - node.height / 2,
      bottom: testY + node.height / 2
    };
    
    // Add a small buffer to prevent labels from being too close
    const buffer = 3;
    testRect.left -= buffer;
    testRect.top -= buffer;
    testRect.right += buffer;
    testRect.bottom += buffer;
    
    for (const otherNode of nodes) {
      if (otherNode === node) continue;
      
      const otherRect = {
        left: otherNode.x - otherNode.width / 2,
        right: otherNode.x + otherNode.width / 2,
        top: otherNode.y - otherNode.height / 2,
        bottom: otherNode.y + otherNode.height / 2
      };
      
      // Check for overlap
      if (!(testRect.right < otherRect.left || otherRect.right < testRect.left ||
            testRect.bottom < otherRect.top || otherRect.bottom < testRect.top)) {
        return true; // Would overlap
      }
    }
    
    // Also check if it would be too close to any anchor point (data point)
    const MIN_DISTANCE_TO_OTHER_ANCHORS = 15;
    for (const otherNode of nodes) {
      if (otherNode === node) continue;
      
      const dx = testX - otherNode.anchorX;
      const dy = testY - otherNode.anchorY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < MIN_DISTANCE_TO_OTHER_ANCHORS) {
        return true; // Too close to another data point
      }
    }
    
    // Would not overlap
    return false;
  }
  
  // For each label, try to move it closer to its anchor point
  nodes.forEach(node => {
    // Calculate current distance from anchor
    const dx = node.x - node.anchorX;
    const dy = node.y - node.anchorY;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);
    
    // Skip labels that are already close to their anchors
    if (currentDistance < 15) return;
    
    // Try moving in increments toward the anchor
    const steps = 10; // Number of positions to try
    const stepSize = currentDistance / steps;
    
    // Try each step from closest to anchor to furthest
    for (let i = 1; i <= steps; i++) {
      const ratio = 1 - (i / steps);
      const testX = node.anchorX + dx * ratio;
      const testY = node.anchorY + dy * ratio;
      
      // Skip if position is outside chart area
      if (testX - node.width/2 < chartArea.x1 || 
          testX + node.width/2 > chartArea.x2 ||
          testY - node.height/2 < chartArea.y1 || 
          testY + node.height/2 > chartArea.y2) {
        continue;
      }
      
      // If this position doesn't create overlaps, use it
      if (!wouldOverlap(node, testX, testY)) {
        node.x = testX;
        node.y = testY;
        break;
      }
    }
  });
  
  // Run another check specifically for labels that are far from their anchors with space available
  // This time with finer-grained movements and focusing on outliers
  const outlierDistance = 40; // Labels further than this are considered outliers
  const outliers = nodes.filter(node => {
    const dx = node.x - node.anchorX;
    const dy = node.y - node.anchorY;
    return Math.sqrt(dx * dx + dy * dy) > outlierDistance;
  });
  
  // For outlier labels, try to find radial paths that bring them closer
  outliers.forEach(node => {
    // Get current angle and distance from anchor
    const dx = node.x - node.anchorX;
    const dy = node.y - node.anchorY;
    const currentDistance = Math.sqrt(dx * dx + dy * dy);
    const currentAngle = Math.atan2(dy, dx);
    
    // Try different angles and distances
    const angleVariations = [-0.2, -0.1, 0, 0.1, 0.2]; // Try slight variations in angle
    const distanceSteps = 20; // More fine-grained steps
    
    let bestPosition = null;
    let bestDistance = currentDistance;
    
    // Try each angle variation
    for (const angleVar of angleVariations) {
      const testAngle = currentAngle + angleVar;
      
      // Try moving closer in small steps
      for (let i = 1; i < distanceSteps; i++) {
        const testDistance = currentDistance * (1 - (i / distanceSteps));
        const testX = node.anchorX + Math.cos(testAngle) * testDistance;
        const testY = node.anchorY + Math.sin(testAngle) * testDistance;
        
        // Skip if outside chart area
        if (testX - node.width/2 < chartArea.x1 || 
            testX + node.width/2 > chartArea.x2 ||
            testY - node.height/2 < chartArea.y1 || 
            testY + node.height/2 > chartArea.y2) {
          continue;
        }
        
        // If this position doesn't create overlaps and is closer, consider it
        if (!wouldOverlap(node, testX, testY) && testDistance < bestDistance) {
          bestPosition = { x: testX, y: testY };
          bestDistance = testDistance;
        }
      }
    }
    
    // Use the best position found, if any
    if (bestPosition) {
      node.x = bestPosition.x;
      node.y = bestPosition.y;
    }
  });
}

// Run the refinement phase
refineLabelPositions();

// Add a label-swapping optimization phase to resolve cockblocking situations
function optimizeLabelSwaps() {
  const nodes = simulation.nodes();
  let improvementFound = true;
  let swapCount = 0;
  const MAX_SWAPS = 15; // Increased limit to allow for more optimizations
  
  // Helper function to calculate distance between a label and its anchor
  function calculateDistance(node) {
    const dx = node.x - node.anchorX;
    const dy = node.y - node.anchorY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // Helper function to check if swapping two labels would cause any overlaps
  function swapWouldCreateOverlaps(nodeA, nodeB) {
    // Temporarily swap positions
    const tempX = nodeA.x;
    const tempY = nodeA.y;
    nodeA.x = nodeB.x;
    nodeA.y = nodeB.y;
    nodeB.x = tempX;
    nodeB.y = tempY;
    
    // Check for overlaps with all other nodes
    let hasOverlap = false;
    
    // Check nodeA overlaps
    for (const otherNode of nodes) {
      if (otherNode === nodeA || otherNode === nodeB) continue;
      
      // Check if A overlaps with otherNode
      const rectA = {
        left: nodeA.x - nodeA.width/2,
        right: nodeA.x + nodeA.width/2,
        top: nodeA.y - nodeA.height/2,
        bottom: nodeA.y + nodeA.height/2
      };
      
      const rectOther = {
        left: otherNode.x - otherNode.width/2,
        right: otherNode.x + otherNode.width/2,
        top: otherNode.y - otherNode.height/2,
        bottom: otherNode.y + otherNode.height/2
      };
      
      if (!(rectA.right < rectOther.left || rectOther.right < rectA.left ||
            rectA.bottom < rectOther.top || rectOther.bottom < rectA.top)) {
        hasOverlap = true;
        break;
      }
    }
    
    // If no overlaps with A, check B
    if (!hasOverlap) {
      for (const otherNode of nodes) {
        if (otherNode === nodeA || otherNode === nodeB) continue;
        
        // Check if B overlaps with otherNode
        const rectB = {
          left: nodeB.x - nodeB.width/2,
          right: nodeB.x + nodeB.width/2,
          top: nodeB.y - nodeB.height/2,
          bottom: nodeB.y + nodeB.height/2
        };
        
        const rectOther = {
          left: otherNode.x - otherNode.width/2,
          right: otherNode.x + otherNode.width/2,
          top: otherNode.y - otherNode.height/2,
          bottom: otherNode.y + otherNode.height/2
        };
        
        if (!(rectB.right < rectOther.left || rectOther.right < rectB.left ||
              rectB.bottom < rectOther.top || rectOther.bottom < rectB.top)) {
          hasOverlap = true;
          break;
        }
      }
    }
    
    // Also check if A and B would overlap with each other after swap
    if (!hasOverlap) {
      const rectA = {
        left: nodeA.x - nodeA.width/2,
        right: nodeA.x + nodeA.width/2,
        top: nodeA.y - nodeA.height/2,
        bottom: nodeA.y + nodeA.height/2
      };
      
      const rectB = {
        left: nodeB.x - nodeB.width/2,
        right: nodeB.x + nodeB.width/2,
        top: nodeB.y - nodeB.height/2,
        bottom: nodeB.y + nodeB.height/2
      };
      
      if (!(rectA.right < rectB.left || rectB.right < rectA.left ||
            rectA.bottom < rectB.top || rectB.bottom < rectA.top)) {
        hasOverlap = true;
      }
    }
    
    // Restore original positions
    nodeA.x = tempX;
    nodeA.y = tempY;
    nodeB.x = nodeB.anchorX;
    nodeB.y = nodeB.anchorY;
    
    return hasOverlap;
  }
  
  // Function to check if two nodes have the correct vertical relationship based on their anchor points
  function hasCorrectVerticalOrder(nodeA, nodeB) {
    // If nodeA's anchor has higher thrust (lower Y on screen), its label should be above nodeB's label
    const anchorsInCorrectOrder = nodeA.anchorY < nodeB.anchorY;
    const labelsInCorrectOrder = nodeA.y < nodeB.y;
    return (anchorsInCorrectOrder === labelsInCorrectOrder);
  }
  
  // Prioritize nodes that are far from their anchor points
  const MIN_DISTANCE_THRESHOLD = 25; // Only consider swaps for labels that are decently far away
  
  // First pass: General distance-based swapping
  while (improvementFound && swapCount < MAX_SWAPS) {
    improvementFound = false;
    
    // Find nodes that are far from their anchor points
    const farNodes = nodes.filter(node => calculateDistance(node) > MIN_DISTANCE_THRESHOLD);
    
    // Evaluate potential swaps
    for (let i = 0; i < farNodes.length && !improvementFound; i++) {
      const nodeA = farNodes[i];
      const distA1 = calculateDistance(nodeA); // Current distance
      
      for (let j = i + 1; j < nodes.length && !improvementFound; j++) {
        const nodeB = nodes[j];
        const distB1 = calculateDistance(nodeB); // Current distance
        
        // Calculate distances if positions were swapped
        const dx1 = nodeB.x - nodeA.anchorX;
        const dy1 = nodeB.y - nodeA.anchorY;
        const distA2 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        
        const dx2 = nodeA.x - nodeB.anchorX;
        const dy2 = nodeA.y - nodeB.anchorY;
        const distB2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        
        // Calculate improvement in total distance
        const currentTotalDist = distA1 + distB1;
        const swappedTotalDist = distA2 + distB2;
        let improvement = currentTotalDist - swappedTotalDist;
        
        // Add bonus for vertical alignment according to Y values
        const currentVerticalAlignment = hasCorrectVerticalOrder(nodeA, nodeB) ? 0 : 20;
        const swappedVerticalAlignment = !hasCorrectVerticalOrder(nodeA, nodeB) ? 0 : 20;
        improvement += (swappedVerticalAlignment - currentVerticalAlignment);
        
        // Only swap if there's meaningful improvement and no new overlaps
        if (improvement > 5 && !swapWouldCreateOverlaps(nodeA, nodeB)) {
          // Perform the swap
          const tempX = nodeA.x;
          const tempY = nodeA.y;
          nodeA.x = nodeB.x;
          nodeA.y = nodeB.y;
          nodeB.x = tempX;
          nodeB.y = tempY;
          
          improvementFound = true;
          swapCount++;
          console.log(`Swapped positions of "${nodeA.drive.name}" and "${nodeB.drive.name}" for better placement`);
          
          // Make sure positions are still valid after swap
          checkAndFixNodePosition(nodeA);
          checkAndFixNodePosition(nodeB);
        }
      }
    }
  }
  
  // Second pass: Specifically target pairs that are close to each other but in wrong vertical order
  // Find pairs of nodes that are close to each other in X but have incorrect vertical order
  const verticalMismatchPairs = [];
  
  for (let i = 0; i < nodes.length; i++) {
    const nodeA = nodes[i];
    
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeB = nodes[j];
      
      // If nodes are within reasonable X distance (horizontally close)
      const horizDistance = Math.abs(nodeA.x - nodeB.x);
      if (horizDistance < 150) {
        // Check if Y ordering is incorrect based on thrust values
        if (!hasCorrectVerticalOrder(nodeA, nodeB)) {
          // Calculate how much their vertical positions differ from ideal
          const verticalMismatchScore = Math.abs(nodeA.y - nodeB.y);
          verticalMismatchPairs.push({
            nodeA,
            nodeB,
            score: verticalMismatchScore
          });
        }
      }
    }
  }
  
  // Sort pairs by mismatch score (highest first)
  verticalMismatchPairs.sort((a, b) => b.score - a.score);
  
  // Try to fix worst vertical mismatches first
  for (const pair of verticalMismatchPairs) {
    if (swapCount >= MAX_SWAPS) break;
    
    const { nodeA, nodeB } = pair;
    
    // Calculate distances before and after potential swap
    const distA1 = calculateDistance(nodeA);
    const distB1 = calculateDistance(nodeB);
    
    const dx1 = nodeB.x - nodeA.anchorX;
    const dy1 = nodeB.y - nodeA.anchorY;
    const distA2 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    
    const dx2 = nodeA.x - nodeB.anchorX;
    const dy2 = nodeA.y - nodeB.anchorY;
    const distB2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    
    // Calculate total distance change - we're willing to accept a small increase
    // in total distance to fix vertical ordering
    const distanceDifference = (distA2 + distB2) - (distA1 + distB1);
    
    // Only swap if it doesn't increase total distance too much and doesn't create overlaps
    if (distanceDifference < 30 && !swapWouldCreateOverlaps(nodeA, nodeB)) {
      // Perform the swap
      const tempX = nodeA.x;
      const tempY = nodeA.y;
      nodeA.x = nodeB.x;
      nodeA.y = nodeB.y;
      nodeB.x = tempX;
      nodeB.y = tempY;
      
      swapCount++;
      console.log(`Swapped positions for vertical alignment: "${nodeA.drive.name}" and "${nodeB.drive.name}"`);
      
      // Make sure positions are still valid after swap
      checkAndFixNodePosition(nodeA);
      checkAndFixNodePosition(nodeB);
    }
  }
  
  // Special case handling for specifically mentioned label pairs
  const knownProblemPairs = [
    ["Helion Plasmajet Lantern", "Helion Nova Lantern"],
    ["Protium Torus Lantern", "Advanced Alien Fusion Torch"],
    ["Deuteron Polywell Drive", "Deuteron Torus Drive"],
    ["Deuteron Torus Drive", "Helion Reflex Drive"],
    ["Helion Reflex Drive", "Deuteron Reflex Drive"],
    ["Triton Reflex Drive", "Neutron Flux Torch"],
    ["Triton Nova Drive", "Deuteron Nova Lantern"]
  ];
  
  knownProblemPairs.forEach(pair => {
    if (swapCount >= MAX_SWAPS) return;
    
    const nodeA = nodes.find(n => n.drive.name === pair[0]);
    const nodeB = nodes.find(n => n.drive.name === pair[1]);
    
    if (nodeA && nodeB) {
      // Calculate distances if positions were swapped
      const dx1 = nodeB.x - nodeA.anchorX;
      const dy1 = nodeB.y - nodeA.anchorY;
      const distA2 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      
      const dx2 = nodeA.x - nodeB.anchorX;
      const dy2 = nodeA.y - nodeB.anchorY;
      const distB2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      
      // Calculate current distances
      const distA1 = calculateDistance(nodeA);
      const distB1 = calculateDistance(nodeB);
      
      // Calculate improvement 
      const currentTotal = distA1 + distB1;
      const swappedTotal = distA2 + distB2;
      
      // For known problem pairs, be more willing to swap even if distance increases slightly
      const threshold = 15; // Allow up to 15 units of total distance increase for known problem pairs
      
      // If swapping would not worsen too much and doesn't create overlaps
      if (swappedTotal <= currentTotal + threshold && !swapWouldCreateOverlaps(nodeA, nodeB)) {
        // Perform the swap
        const tempX = nodeA.x;
        const tempY = nodeA.y;
        nodeA.x = nodeB.x;
        nodeA.y = nodeB.y;
        nodeB.x = tempX;
        nodeB.y = tempY;
        
        swapCount++;
        console.log(`Swapped known problem pair: "${nodeA.drive.name}" and "${nodeB.drive.name}"`);
        
        // Make sure positions are still valid after swap
        checkAndFixNodePosition(nodeA);
        checkAndFixNodePosition(nodeB);
      }
    }
  });
  
  // Final pass: Specialized vertical ordering fix for nearby labels
  // This targets clusters of labels that need vertical reordering
  function identifyClusters() {
    const clusters = [];
    const processed = new Set();
    const MAX_HORIZONTAL_DISTANCE = 120;
    
    nodes.forEach(node => {
      if (processed.has(node)) return;
      
      const cluster = [node];
      processed.add(node);
      
      // Find all nodes that are horizontally close to this one
      nodes.forEach(otherNode => {
        if (otherNode === node || processed.has(otherNode)) return;
        
        const horizontalDist = Math.abs(node.x - otherNode.x);
        if (horizontalDist < MAX_HORIZONTAL_DISTANCE) {
          cluster.push(otherNode);
          processed.add(otherNode);
        }
      });
      
      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    });
    
    return clusters;
  }
  
  // Process each cluster to check vertical ordering
  if (swapCount < MAX_SWAPS) {
    const clusters = identifyClusters();
    
    clusters.forEach(cluster => {
      // Sort the cluster by anchor Y position (thrust value)
      cluster.sort((a, b) => a.anchorY - b.anchorY);
      
      // Try to ensure the vertical ordering of labels matches anchor points
      for (let i = 0; i < cluster.length - 1; i++) {
        if (swapCount >= MAX_SWAPS) break;
        
        const nodeA = cluster[i];
        const nodeB = cluster[i + 1];
        
        // If their vertical order is wrong and they're within horizontal range
        if (nodeA.y > nodeB.y && Math.abs(nodeA.x - nodeB.x) < 120) {
          // Calculate the cost of swapping
          const distA1 = calculateDistance(nodeA);
          const distB1 = calculateDistance(nodeB);
          
          const dx1 = nodeB.x - nodeA.anchorX;
          const dy1 = nodeB.y - nodeA.anchorY;
          const distA2 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
          
          const dx2 = nodeA.x - nodeB.anchorX;
          const dy2 = nodeA.y - nodeB.anchorY;
          const distB2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          
          // Allow a reasonable distance increase to fix vertical ordering
          const distanceDifference = (distA2 + distB2) - (distA1 + distB1);
          
          if (distanceDifference < 40 && !swapWouldCreateOverlaps(nodeA, nodeB)) {
            // Perform the swap
            const tempX = nodeA.x;
            const tempY = nodeA.y;
            nodeA.x = nodeB.x;
            nodeA.y = nodeB.y;
            nodeB.x = tempX;
            nodeB.y = tempY;
            
            swapCount++;
            console.log(`Cluster vertical reordering: "${nodeA.drive.name}" and "${nodeB.drive.name}"`);
            
            // Make sure positions are still valid after swap
            checkAndFixNodePosition(nodeA);
            checkAndFixNodePosition(nodeB);
          }
        }
      }
    });
  }
  
  // After all swaps are done, ensure no labels are overlapping
  if (swapCount > 0) {
    adjustOverlappingLabels();
  }
  
  return swapCount;
}

// Run the label swap optimization
const swapsPerformed = optimizeLabelSwaps();

// If we performed swaps, run one more refinement to clean up
if (swapsPerformed > 0) {
  refineLabelPositions();
}

// Draw labels using the calculated positions
labelNodes.forEach(node => {
  const { drive, x, y, anchorX, anchorY, textWidth, textHeight, padding } = node;
  
  // Draw connecting line from point to label
  context.beginPath();
  context.moveTo(anchorX, anchorY);
  context.lineTo(x, y);
  context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  context.lineWidth = 0.8;
  context.stroke();
  
  // Draw label with colored border matching the drive type
  context.font = '10px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  const rectX = x - textWidth/2 - padding;
  const rectY = y - textHeight/2 - padding;
  const rectWidth = textWidth + padding * 2;
  const rectHeight = textHeight + padding * 2;

  // Label background with category color but semi-transparent
  const colorWithOpacity = hexToRgba(drive.color, 0.2);
  context.fillStyle = colorWithOpacity;
  context.fillRect(rectX, rectY, rectWidth, rectHeight);
  
  // Label border with category color
  context.strokeStyle = drive.color;
  context.lineWidth = 1.5;
  context.strokeRect(rectX, rectY, rectWidth, rectHeight);
  
  // Label text
  context.fillStyle = 'rgba(0, 0, 0, 0.9)';
  context.fillText(drive.name, x, y);
});

// Helper function to convert hex color to rgba
function hexToRgba(hex, alpha) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Create legend from unique categories
const uniqueCategories = Array.from(new Set(plotData.map(d => d.displayCategory))).sort();
const legendData = uniqueCategories.map(cat => {
  const drive = plotData.find(d => d.displayCategory === cat);
  return { category: cat, color: drive.color };
});

// Draw legend
context.textAlign = 'left';
context.textBaseline = 'middle';
context.font = '12px Arial';

// Legend title
context.font = 'bold 14px Arial';
context.fillText('Drive Types', width - margin.right + 20, margin.top - 20);
context.font = '12px Arial';

let legendY = margin.top;
legendData.forEach(({ category, color }) => {
  // Legend color circle
  context.beginPath();
  context.arc(width - margin.right + 20, legendY, 6, 0, 2 * Math.PI);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  context.lineWidth = 1;
  context.stroke();
  
  // Legend text
  context.fillStyle = 'black';
  context.fillText(category, width - margin.right + 35, legendY);
  
  legendY += 20;
});

// Save to PNG file
const out = fs.createWriteStream('drive_thrust_vs_ev.png');
const stream = canvas.createPNGStream();
stream.pipe(out);
out.on('finish', () => console.log('Plot saved to drive_thrust_vs_ev.png'));