import json
import sys
from collections import defaultdict

def export_thrust_vs_ev_data(json_file, output_file="drive_data.json"):
    # Load the JSON data
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    # Define a color scheme that will be included in the output data
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
            power_type = required_power_plant.split('_')[0] if required_power_plant else ''
            return f"{base_class}_{power_type}"
        if base_class == 'Fusion':
            power_type = required_power_plant.split('_')[0] if required_power_plant else ''
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
            drive_class = get_drive_category(
                item['driveClassification'], 
                drive_name, 
                item.get('requiredPowerPlant', '')
            )
                
            drive_types[drive_class]['thrust'].append(float(item['thrust_N']))
            drive_types[drive_class]['ev'].append(float(item['EV_kps']))
            drive_types[drive_class]['names'].append(drive_name)
            drive_types[drive_class]['drive_classes'].append(item['driveClassification'])
    
    # Get unique drive classes for the output
    unique_categories = sorted(drive_types.keys())
    
    # Create the output data structure
    output_data = {
        "metadata": {
            "title": "Terra Invicta Drive Chart - Single Thruster - Combat Thrust vs. Exhaust Velocity",
            "xAxis": {
                "label": "Exhaust Velocity (km/s)",
                "scale": "log",
                "min": 2,
                "max": 2e4
            },
            "yAxis": {
                "label": "Thrust (N)",
                "scale": "log",
                "min": 1e2,
                "max": 3e7
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
        color = color_map.get(category, '#888888')  # Default gray for unknown types
        
        # Create list of drive points
        drives = []
        for thrust, ev, name, drive_class in zip(
                values['thrust'], 
                values['ev'], 
                values['names'], 
                values['drive_classes']):
            drives.append({
                "ev": ev,  # EV is x-axis
                "thrust": thrust,  # Thrust is y-axis
                "name": name,
            })
        
        # Add to output
        output_data["categories"][category] = {
            "displayName": category.replace('_', ' '),
            "color": color,
            "drives": drives
        }
    
    # Write to JSON file
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    print(f"Drive data exported to {output_file}")
    return output_data

if __name__ == "__main__":
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
    else:
        # Default path if none provided
        json_file = "public/gamefiles/Templates/TIDriveTemplate.json"
    
    output_file = "drive_data.json"
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    print(f"Processing drive data from {json_file}...")
    export_thrust_vs_ev_data(json_file, output_file)