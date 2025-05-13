import json
import os
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import numpy as np
import networkx as nx
from matplotlib.ticker import ScalarFormatter
from matplotlib.path import Path
import matplotlib.patches as patches

def process_drive_data(json_file, localization_file, use_combat_thrust=True):
    """Process the drive data from the JSON file and localization file.
    
    Args:
        json_file: Path to the JSON file containing drive data
        localization_file: Path to the localization file
        use_combat_thrust: If True, multiply thrust by thrustCap for combat thrust
                          If False, use base thrust for cruise thrust
    """
    thrust_type = "combat" if use_combat_thrust else "cruise"
    print(f"Processing drive data from {json_file} and localization from {localization_file} for {thrust_type} thrust...")

    # Load the JSON data
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Load the localization data
    with open(localization_file, 'r', encoding='utf-8') as f:
        localization = dict(line.strip().split('=', 1) for line in f if 'displayName' in line)

    # Define a more detailed color scheme based on the reference image
    color_map = {
        'Chemical': '#CC0000',
        'Electrothermal': '#CCC2CC',
        'Electrostatic': '#7F6000',
        'Electromagnetic': '#DDAA00',
        'Fission_Thermal': '#663300',
        'Fission_SaltWater': '#996633',
        'Fission_Gas': '#144205',
        'Fission_Solid': '#548285',
        'Fission_Pulse': '#FFF2CC',
        'Fusion_Electrostatic': '#0066CC',
        'Fusion_Toroid': '#FBE5D6',
        'Fusion_Mirrored': '#F4B183',
        'Fusion_Hybrid': '#94748A',
        'Fusion_ZPinch': '#BDD7EE',
        'Fusion_Inertial': '#4472C4',
        "Fission_Any": "#CCF2CC",
        "Fission_Liquid": "#a4c2a5",
        'Antimatter': '#000000',
        'Alien': '#7030A0',
        'NuclearSaltWater': '#A6A6A6',
    }

    # Helper function to determine the main drive category
    def get_drive_category(classification, name, required_power_plant):
        # Special handling for Alien drives
        if name and 'Alien' in name:
            return 'Alien'
            
        base_class = classification.split('_')[0]
        if base_class == 'Fission':
            power_type = required_power_plant.split('_')[0]
            return f"{base_class}_{power_type}"
        if base_class == 'Fusion':
            power_type = required_power_plant.split('_')[0]
            if power_type == 'Z':
                power_type = 'ZPinch'
            return f"{base_class}_{power_type}"
        return base_class
    
    # Group data by driveClassification and filter for x1 drives only
    drive_types = {}
    
    for item in data:
        if 'disable' in item and item['disable']:
            continue

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
            drive_name = localization.get("TIDriveTemplate.displayName.{}".format(item['dataName']), item['dataName'])
            # Remove the 'x1' suffix from the name if it exists
            if drive_name.endswith(' x1'):
                drive_name = drive_name[:-3]
            
            # Get appropriate category, considering if it's Alien technology
            drive_class = get_drive_category(
                item['driveClassification'], 
                drive_name, 
                item.get('requiredPowerPlant', '')
            )
                
            # Initialize category if not exists
            if drive_class not in drive_types:
                drive_types[drive_class] = {
                    'thrust': [], 
                    'ev': [], 
                    'names': [], 
                    'drive_classes': [],
                    'cooling_types': []  # Add a new list for cooling types
                }
            
            # Apply thrustCap multiplier only for combat thrust
            if use_combat_thrust:
                thrust_value = float(item['thrust_N']) * float(item['thrustCap'])
            else:
                thrust_value = float(item['thrust_N'])
                
            drive_types[drive_class]['thrust'].append(thrust_value)
            drive_types[drive_class]['ev'].append(float(item['EV_kps']))
            drive_types[drive_class]['names'].append(drive_name)
            drive_types[drive_class]['drive_classes'].append(item['driveClassification'])
            
            # Calculate cooling type based on formula
            cooling = item.get('cooling', 'Open')
            if cooling == 'Calc':
                # Calculate massFlow_kgs = thrust_N / (EV_kps * 1000)
                mass_flow = float(item['thrust_N']) / (float(item['EV_kps']) * 1000.0)
                # Check if it's a pulsed drive based on classification
                drive_classification = item.get('driveClassification', '')
                is_pulsed = drive_classification == 'Fission_Pulse' or drive_classification == 'Fusion_Pulse'

                # public bool openCycleCooling
                # {
                #     get
                #     {
                #         return this.cooling == CoolingCycle.Open || (this.cooling == CoolingCycle.Calc && (this.pulsedDrive || this.singleThrusterTemplate.massFlow_kgs >= 3f));
                #     }
                # }

                cooling = 'Open' if (is_pulsed or mass_flow >= 3.0) else 'Closed'
            
            drive_types[drive_class]['cooling_types'].append(cooling)  # Extract cooling type
    
    # Get unique drive classes for the output
    unique_categories = sorted(drive_types.keys())
    
    # Create the output data structure
    thrust_label = "Combat Thrust" if use_combat_thrust else "Thrust"
    output_data = {
        "metadata": {
            "title": f"Terra Invicta Drive Chart - {thrust_label} vs. Exhaust Velocity",
            "xAxis": {
                "label": "Exhaust Velocity (km/s)",
                "scale": "log",
                "min": 2,
                "max": 2e4
            },
            "yAxis": {
                "label": f"{thrust_label} (N)",
                "scale": "log",
                "min": 1e2,
                "max": 300e7
            }
        },
        "colorMap": color_map,
        "categories": {}
    }
    
    # Populate the categories data
    for category in unique_categories:
        values = drive_types[category]
        
        # Skip if no values for this drive type
        if not values['thrust']:
            continue
        
        # Get color for this category
        color = color_map.get(category)
        if not color:
            raise ValueError(f"Color not found for category: {category}")
        
        # Create list of drive points
        drives = []
        for i in range(len(values['thrust'])):
            drives.append({
                "ev": values['ev'][i],  # EV is x-axis
                "thrust": values['thrust'][i],  # Thrust is y-axis
                "name": values['names'][i],
                "cooling": values['cooling_types'][i]  # Add cooling type
            })
        
        # Add to output
        output_data["categories"][category] = {
            "displayName": category.replace('_', ' '),
            "drives": drives
        }
    
    print("Drive data processing complete")
    return output_data

def generate_optimized_svg_plot(output_data, output_file, fig_width=18, fig_height=12, show_annotations=True):
    """Generate an optimized SVG plot of the drive data using matplotlib with smart label placement.
    
    Args:
        output_data: The processed drive data dictionary
        output_file: Path where the SVG file will be saved
        fig_width: Width of the figure in inches
        fig_height: Height of the figure in inches
        show_annotations: Whether to show drive names as annotations
    """
    print(f"Generating optimized SVG plot to {output_file}...")
    
    # Import adjustText for label placement
    from adjustText import adjust_text
    
    # Create figure and axes with specified size - larger size for better label separation
    plt.figure(figsize=(fig_width, fig_height), dpi=600)
    ax = plt.subplot(111)
    
    # Set logarithmic scales
    ax.set_xscale('log')
    ax.set_yscale('log')
    
    # Set axis limits from metadata
    metadata = output_data['metadata']
    ax.set_xlim(metadata['xAxis']['min'], metadata['xAxis']['max'])
    
    # Find the actual min and max thrust values in the data
    all_thrust_values = []
    for category in output_data['categories'].values():
        for drive in category['drives']:
            all_thrust_values.append(drive['thrust'])
    
    if all_thrust_values:  # Only adjust if we have data
        data_min = min(all_thrust_values) * 0.5  # Provide some padding below
        data_max = max(all_thrust_values) * 2.0  # Provide some padding above
        
        # Update the y-axis limits based on the actual data while ensuring they're not too narrow
        y_min = max(metadata['yAxis']['min'], min(data_min, metadata['yAxis']['min'] * 10))
        y_max = max(metadata['yAxis']['max'] * 0.01, data_max)
        
        ax.set_ylim(y_min, y_max)
    else:
        # Fall back to metadata values if no data points
        ax.set_ylim(metadata['yAxis']['min'], metadata['yAxis']['max'])
    
    # Set axis labels
    ax.set_xlabel(metadata['xAxis']['label'], fontsize=14, weight='bold')
    ax.set_ylabel(metadata['yAxis']['label'], fontsize=14, weight='bold')
    
    # Set title
    plt.title(metadata['title'], fontsize=18, pad=20, weight='bold')
    
    # Add enhanced grid with more features
    # Major and minor grid lines with different styles
    ax.grid(True, which="major", ls="-", alpha=0.3, color='gray')
    ax.grid(True, which="minor", ls=":", alpha=0.15, color='gray')
    
    # Add reference lines for specific values of interest
    reference_ev_values = [10, 100, 1000, 10000]
    for ev in reference_ev_values:
        ax.axvline(x=ev, color='gray', linestyle='--', alpha=0.3)
        
    # Add power-of-ten reference lines for thrust
    reference_thrust_values = [1e3, 1e5, 1e7]
    for thrust in reference_thrust_values:
        ax.axhline(y=thrust, color='gray', linestyle='--', alpha=0.3)
               
    # Add light colored regions to distinguish thrust ranges
    thrust_regions = [(metadata['yAxis']['min'], 1e4, '#f8f8f8'),  # Low thrust
                      (1e4, 1e6, '#f0f0f0'),                       # Medium thrust
                      (1e6, metadata['yAxis']['max'], '#e8e8e8')]  # High thrust
                      
    for y_min, y_max, color in thrust_regions:
        ax.axhspan(y_min, y_max, color=color, alpha=0.3, zorder=0)
    
    # Plot each category of drives with a consistent, visually distinct appearance
    markers = ['o', 's', '^', 'D', 'v', '<', '>', 'p', '*', 'h', 'X', 'P']
    marker_index = 0
    legend_elements = []
    
    # Sort categories for consistent appearance across different runs
    sorted_categories = sorted(output_data['categories'].keys())
    
    # Collection to hold all text objects for adjustText later
    all_texts = []
    
    for category_name in sorted_categories:
        category_data = output_data['categories'][category_name]
        
        # Get color for this category
        color = output_data['colorMap'].get(category_name, '#333333')
        
        # Extract data for plotting
        x_values = [drive['ev'] for drive in category_data['drives']]
        y_values = [drive['thrust'] for drive in category_data['drives']]
        names = [drive['name'] for drive in category_data['drives']]
        
        # Select marker style
        marker = markers[marker_index % len(markers)]
        marker_index += 1
        
        # First add glow effect around points for better visibility
        # This creates a halo effect behind the actual data points
        glow = ax.scatter(x_values, y_values, 
                 color='white', 
                 marker=marker,
                 s=120,  # Larger size for the glow
                 alpha=0.6,  # Semi-transparent
                 edgecolors='black',
                 linewidths=2.0,
                 label=None,
                 zorder=90) 
                 
        # Plot the points with enhanced visual distinctiveness
        scatter = ax.scatter(x_values, y_values, 
                 color=color, 
                 marker=marker,
                 s=100,  # Increased size for better visibility (from 80)
                 alpha=0.95,  # Less transparency for better visibility (from 0.85)
                 edgecolors='black',
                 linewidths=1.0,  # Slightly thicker border
                 label=category_data['displayName'],
                 zorder=80)  

        # Add drive names as annotations (will adjust positions later using adjustText)
        if show_annotations:
            for i, drive in enumerate(category_data['drives']):
                name = drive['name']
                cooling_type = drive['cooling']
                
                # Determine text color based on background color brightness
                text_color = 'black'
                bg_color = color
                if sum(int(bg_color[i:i+2], 16) for i in (1, 3, 5)) < 384:  # Dark background
                    bg_color = color + '50'  # More transparency (from '60')
                    text_color = 'white'
                else:
                    bg_color = color + '50'  # More transparency (from '80')
                    text_color = 'black'
                
                # Create text object with offset from point
                # Small offset to avoid direct overlap with point
                offset_x = 0.03 * x_values[i]  # Offset based on x position (proportional)
                offset_y = 0.03 * y_values[i]  # Offset based on y position (proportional)
                
                # Create bbox styles
                bbox_props = dict(
                    boxstyle="round,pad=0.3",
                    fc=bg_color,
                    ec='#33333340',  # More transparent edge
                    alpha=0.7  # More transparent background (from 0.85)
                )
                
                # Create a display name with a prefix symbol based on cooling type
                cooling_symbols = {
                    "Open": "● ",   # Circle symbol for Open
                    "Closed": "■ "  # Square symbol for Closed
                }
                display_name = cooling_symbols.get(cooling_type, "") + name
                
                text = ax.text(
                    x_values[i] + offset_x, y_values[i] + offset_y, display_name,
                    fontsize=7.5,
                    color=text_color,
                    weight='normal',
                    ha='center', va='center',
                    bbox=bbox_props,
                    zorder=120
                )
                
                all_texts.append(text)
        
        # Add to legend
        legend_elements.append(scatter)
    
    # Apply adjustText to optimize label placement and avoid overlaps
    if show_annotations and all_texts:
        # Configure adjustText parameters for best results
        adjust_text(
            all_texts,
            # Force parameters control repulsion between objects
            force_points=150.0,  # Increased repulsion between points and texts (from 10.2)
            force_text=1200.0,   # Increased repulsion between texts (from 100.0)
            # Expand parameters control repulsion "area of influence"
            expand_points=(300.5, 300.5),  # Increased area of point influence (from 2.6, 1.6)
            expand_text=(100.5, 200.0),    # Increased area of text influence (from 1.3, 1.6)
            # Add connecting lines between points and labels
            arrowprops=dict(
                arrowstyle='-',
                color='#66666680',  # More transparent connecting lines
                alpha=0.6,         # More visible lines (from 0.5)
                connectionstyle="arc3,rad=0.15",  # Slightly more curved lines
                linewidth=0.6,     # Thin but visible lines
            ),
            # Additional parameters for fine-tuning
            ax=ax,
            lim=400,  # Increased maximum number of iterations for better placement (from 300)
            only_move={'points': 'xy', 'texts': 'xy'},  # Allow movement in both x and y directions
            add_objects=None,  # Any additional objects to consider in the arrangement
            autoalign=False,   # Do not use automatic alignment
            avoid_points=True, # Avoid points when placing texts
            avoid_self=True,   # Texts avoid each other
            # Additional parameters to control optimization
            ha='center', va='center',
        )
    
    # Create a more compact and visually appealing legend
    legend_columns = 1  # Number of columns in legend
    
    # Group similar categories in the legend
    sorted_handles = []
    sorted_labels = []
    
    # First group: Fission drives
    fission_handles = [h for h, l in zip(legend_elements, [item.get_label() for item in legend_elements]) if 'Fission' in l]
    fission_labels = [l for l in [item.get_label() for item in legend_elements] if 'Fission' in l]
    sorted_handles.extend(fission_handles)
    sorted_labels.extend(fission_labels)
    
    # Second group: Fusion drives
    fusion_handles = [h for h, l in zip(legend_elements, [item.get_label() for item in legend_elements]) if 'Fusion' in l]
    fusion_labels = [l for l in [item.get_label() for item in legend_elements] if 'Fusion' in l]
    sorted_handles.extend(fusion_handles)
    sorted_labels.extend(fusion_labels)
    
    # Third group: Other drives
    other_handles = [h for h, l in zip(legend_elements, [item.get_label() for item in legend_elements]) 
                    if not ('Fusion' in l or 'Fission' in l)]
    other_labels = [l for l in [item.get_label() for item in legend_elements] 
                   if not ('Fusion' in l or 'Fission' in l)]
    sorted_handles.extend(other_handles)
    sorted_labels.extend(other_labels)
    
    # Add legend with customized properties
    legend = ax.legend(
        sorted_handles, 
        sorted_labels, 
        bbox_to_anchor=(1.01, 1.01),
        loc='upper left',
        fontsize=9,
        title='Drive Categories',
        title_fontsize=11,
        frameon=True,
        framealpha=0.95,
        fancybox=True,
        ncol=legend_columns
    )
    
    # Make legend title bold
    legend.get_title().set_fontweight('bold')
    
    # Add a separate cooling type legend
    from matplotlib.patches import Patch
    cooling_legend_elements = [
        Patch(facecolor='white', edgecolor='white', label='● Open', alpha=0.7),
        Patch(facecolor='white', edgecolor='white', label='■ Closed', alpha=0.7)
    ]
    
    # Place cooling legend below the drive categories legend
    cooling_legend = ax.legend(
        handles=cooling_legend_elements,
        title='Cooling Types',
        loc='upper left',
        bbox_to_anchor=(1.01, 0.65),
        fontsize=9,
        title_fontsize=11,
        frameon=True,
        framealpha=0.95
    )
    
    # Make cooling legend title bold
    cooling_legend.get_title().set_fontweight('bold')
    
    # Add the cooling legend to the plot
    ax.add_artist(legend)  # Re-add the first legend
    
    # Adjust layout to make room for legend
    plt.tight_layout(rect=[0.02, 0.02, 0.85, 0.98])
    
    # Save as SVG only
    plt.savefig(output_file, format='svg', bbox_inches='tight', transparent=False)
    print(f"SVG plot generated successfully at {output_file}")
    
    # Close the plot to free memory
    plt.close()

# print the output_data and generate SVG
def main():
    # Define the path to the JSON file and localization file
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_file = os.path.join(base_dir, '..', 'public', 'gamefiles', 'Templates', 'TIDriveTemplate.json')
    localization_file = os.path.join(base_dir, '..', 'public', 'gamefiles', 'Localization', 'en', 'TIDriveTemplate.en')

    # Generate both combat and cruise thrust charts
    
    # 1. Generate combat thrust chart (with thrustCap multiplier)
    combat_output_data = process_drive_data(json_file, localization_file, use_combat_thrust=True)
    generate_optimized_svg_plot(
        combat_output_data, 
        'combat_thrust_chart.svg', 
        fig_width=18, 
        fig_height=12
    )
    
    # 2. Generate cruise thrust chart (without thrustCap multiplier)
    cruise_output_data = process_drive_data(json_file, localization_file, use_combat_thrust=False)
    generate_optimized_svg_plot(
        cruise_output_data, 
        'cruise_thrust_chart.svg', 
        fig_width=18, 
        fig_height=12
    )
    
    print("Process completed successfully. Generated both combat and cruise thrust charts.")
    
if __name__ == "__main__":
    main()