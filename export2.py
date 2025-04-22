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
    
    # Write to JSON file
    with open("drive_data.json", 'w') as f:
        json.dump(drive_types, f, indent=2)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        json_file = sys.argv[1]
    else:
        # Default path if none provided
        json_file = "public/gamefiles/Templates/TIDriveTemplate.json"
    
    print(f"Generating plot from {json_file}...")
    plot_thrust_vs_ev(json_file)