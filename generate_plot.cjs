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
const simulation = d3.forceSimulation(labelNodes)
  // Use custom forces that maintain balance between label proximity and avoiding overlap
  .force('collision', d3.forceCollide().radius(d => Math.sqrt(d.width * d.width + d.height * d.height) / 2).strength(0.002))
  // Strong attraction to anchor point
  .force('anchor-x', d3.forceX(d => d.anchorX).strength(0.2))
  .force('anchor-y', d3.forceY(d => d.anchorY).strength(0.2))
  // Keep labels within chart boundaries
  .force('bound-x', d3.forceX(d => {
    if (d.x - d.width/2 < chartArea.x1) return chartArea.x1 + d.width/2;
    if (d.x + d.width/2 > chartArea.x2) return chartArea.x2 - d.width/2;
    return d.x;
  }).strength(1))
  .force('bound-y', d3.forceY(d => {
    if (d.y - d.height/2 < chartArea.y1) return chartArea.y1 + d.height/2;
    if (d.y + d.height/2 > chartArea.y2) return chartArea.y2 - d.height/2;
    return d.y;
  }).strength(1));

// Run the simulation
for (let i = 0; i < 300; i++) {
  simulation.tick();
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