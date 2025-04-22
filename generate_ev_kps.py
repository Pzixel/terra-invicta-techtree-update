import json
import matplotlib.pyplot as plt
import sys
import numpy as np
from collections import defaultdict
import matplotlib.patheffects as path_effects

def plot_thrust_vs_ev(json_file):
    # Load the JSON data
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    # Create figure and axes with more space
    fig, ax = plt.subplots(figsize=(18, 14))
    
    # Define a more detailed color scheme based on the reference image
    color_map = {
        'Chemical': '#CC0000',
        'Electrothermal': '#CCC2CC',
        'Electrostatic': '#7F6000',
        'Electromagnetic': '#CC0000',
        'Fission_Thermal': '#663300',
        'Fission_SaltWater': '#996633',
        'Fission_Gas': '#548235',
        'Fission_Solid': '#548235',
        'Fission_Pulse': '#FFF2CC',
        'Fusion_Electrostatic': '#0066CC',
        'Fusion_Toroid': '#FBE5D6',
        'Fusion_Mirrored': '#F4B183',
        'Fusion_Hybrid': '#44546A',
        'Fusion_ZPinch': '#BDD7EE',
        'Fusion_Inertial': '#4472C4',
        'Antimatter': '#404040',
        'Alien': '#7030A0'
    }
    
    # Helper function to determine the main drive category
    def get_drive_category(classification, name, required_power_plant):
        # Special handling for Alien drives
        if name and name.startswith("Alien"):
            return "Alien"
            
        base_class = classification.split('_')[0]
        if base_class == 'Fission':
            power_type = required_power_plant.split('_')[0]
            return f"{base_class}_{power_type}"
        if base_class == 'Fusion':
            power_type = required_power_plant.split('_')[0]
            return f"{base_class}_{power_type}"
        return base_class
    
    # Group data by driveClassification and filter for x1 drives only
    drive_types = defaultdict(lambda: {'thrust': [], 'ev': [], 'names': [], 'drive_classes': []})
    
    for item in data:
        # Skip items missing required fields
        if not all(key in item for key in ['thrust_N', 'EV_kps', 'driveClassification']):
            continue
            
        # Filter for x1 drives (either by name or thruster count)
        is_x1 = False
        if 'dataName' in item and item['dataName'].endswith('x1'):
            is_x1 = True
        elif 'thrusters' in item and item['thrusters'] == 1:
            is_x1 = True
            
        if is_x1:
            # Use friendlyName if available, otherwise dataName
            drive_name = item.get('friendlyName', item.get('dataName', 'Unknown'))
            # Remove the 'x1' suffix from the name if it exists
            if drive_name.endswith(' x1'):
                drive_name = drive_name[:-3]
            
            # Get appropriate category, considering if it's Alien technology
            drive_class = get_drive_category(item['driveClassification'], drive_name, item.get('requiredPowerPlant'))
                
            drive_types[drive_class]['thrust'].append(float(item['thrust_N']))
            drive_types[drive_class]['ev'].append(float(item['EV_kps']))
            drive_types[drive_class]['names'].append(drive_name)
            drive_types[drive_class]['drive_classes'].append(item['driveClassification'])
    
    # Get unique drive classes for legend
    unique_categories = sorted(drive_types.keys())
    
    # Plot each drive classification with the appropriate color
    # INVERTED AXES: EV (X) and Thrust (Y)
    for category in unique_categories:
        values = drive_types[category]
        
        # Skip if no values for this drive type
        if not values['thrust']:
            continue
        
        # Get color
        color = color_map.get(category, '#888888')  # Default gray for unknown types
        
        # Plot points - INVERTED: ev is X, thrust is Y
        sc = ax.scatter(
            values['ev'], 
            values['thrust'],
            label=category.replace('_', ' '),
            color=color,
            alpha=0.8,
            s=80,  # Make points larger
            edgecolors='black',
            linewidths=0.5
        )
    
    # Smart label placement - we'll calculate positions after all points are plotted
    label_positions = {}
    point_density = {}
    
    # Calculate point density for each point - adapted for inverted axes
    for category in unique_categories:
        values = drive_types[category]
        for i, (thrust, ev) in enumerate(zip(values['thrust'], values['ev'])):
            # Calculate number of nearby points
            count = 0
            log_thrust = np.log10(thrust)
            log_ev = np.log10(ev)
            
            for cat2 in unique_categories:
                for t2, e2 in zip(drive_types[cat2]['thrust'], drive_types[cat2]['ev']):
                    log_t2 = np.log10(t2)
                    log_e2 = np.log10(e2)
                    # Check distance in log space
                    if (log_thrust - log_t2)**2 + (log_ev - log_e2)**2 < 0.2**2:
                        count += 1
                        
            point_density[(ev, thrust)] = count  # Note: ev, thrust order for inverted axes
    
    # Define angle ranges for different regions of the plot - adapted for inverted axes
    def get_angle(ev, thrust):
        # 0 = right, 90 = top, 180 = left, 270 = bottom
        if ev < 100:  # Low EV
            if thrust > 100000:
                return np.random.uniform(0, 45)  # top-right
            else:
                return np.random.uniform(-45, 45)  # middle-right
        elif ev < 1000:  # Medium EV
            if thrust > 100000:
                return np.random.uniform(0, 90)  # top
            elif thrust < 1000:
                return np.random.uniform(270, 360)  # bottom
            else:
                density = point_density.get((ev, thrust), 0)
                # Spread more in dense areas
                return np.random.uniform(0, 360)
        else:  # High EV
            if thrust > 100000:
                return np.random.uniform(45, 90)  # top-left
            else:
                return np.random.uniform(135, 225)  # left
    
    # Add labels with smart positioning - adapted for inverted axes
    for category in unique_categories:
        values = drive_types[category]
        color = color_map.get(category, '#888888')
        
        for i, (thrust, ev, name) in enumerate(zip(values['thrust'], values['ev'], values['names'])):
            # Get angle for this point
            angle = get_angle(ev, thrust)
            
            # Calculate distance based on density (more dense = more distance)
            density = point_density.get((ev, thrust), 1)
            distance = 35 + min(density * 5, 30)  # Base distance + density factor
            
            # Convert to x,y offset
            dx = distance * np.cos(np.radians(angle))
            dy = distance * np.sin(np.radians(angle))
            
            # Add label with offset - inverted axes (ev, thrust)
            text = ax.annotate(
                name,
                xy=(ev, thrust),
                xytext=(dx, dy),
                textcoords='offset points',
                fontsize=9,
                color=color,
                bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', pad=2),
                ha='center',
                va='center',
                arrowprops=dict(
                    arrowstyle='-',
                    color='gray',
                    lw=0.5,
                    alpha=0.7
                )
            )
            
            # Add a subtle border around text to make it more readable
            text.set_path_effects([
                path_effects.withStroke(linewidth=2, foreground='white')
            ])
    
    # Set log scales for both axes
    ax.set_xscale('log')
    ax.set_yscale('log')
    
    # Set axis limits similar to reference chart - inverted
    ax.set_xlim(2, 2e4)
    ax.set_ylim(1e2, 3e7)
    
    # Add labels and title - inverted
    ax.set_xlabel('Exhaust Velocity (km/s)', fontsize=14)
    ax.set_ylabel('Thrust (N)', fontsize=14)
    ax.set_title('Terra Invicta Drive Chart - Single Thruster - Combat Thrust vs. Exhaust Velocity', fontsize=16)
    
    # Add grid for better readability
    ax.grid(True, which='both', linestyle='--', linewidth=0.5, alpha=0.7)
    
    # Add legend outside the plot area
    handles, labels = ax.get_legend_handles_labels()
    
    # Sort legend by label
    legend_data = sorted(zip(labels, handles), key=lambda t: t[0])
    labels, handles = zip(*legend_data)
    
    legend = ax.legend(
        handles, labels,
        bbox_to_anchor=(1.05, 1),
        loc='upper left',
        fontsize=11,
        frameon=True,
        fancybox=True,
        shadow=True
    )
    
    # Ensure the legend text colors match point colors
    for text, category in zip(legend.get_texts(), sorted(unique_categories)):
        category_formatted = category.replace('_', ' ')
        # Find matching category
        for i, label in enumerate(labels):
            if label == category_formatted:
                text.set_color(color_map.get(category, '#888888'))
                break
    
    # Save figure with adjusted bbox to include legend
    plt.savefig('thrust_vs_ev_plot_labeled.png', dpi=300, bbox_inches='tight')
    print("Plot saved as 'thrust_vs_ev_plot_labeled.png'")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
    else:
        # Default path if none provided
        json_file = "public/gamefiles/Templates/TIDriveTemplate.json"
    
    print(f"Generating plot from {json_file}...")
    plot_thrust_vs_ev(json_file)