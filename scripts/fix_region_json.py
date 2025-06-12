import json
import os


def main():
    # Define the path to the JSON file and localization file
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_file = os.path.join(base_dir, '..', 'public', 'gamefiles', 'Templates', 'TIRegionTemplate.json')

    with open(json_file, 'r') as f:
        data = json.load(f)
        # fix JSON missing keys, set undefined to false
        # data is an array of region objects, so iterate through each region
        for region in data:
            if 'mineCapable' not in region:
                region['mineCapable'] = False
            if 'oilCapable' not in region:
                region['oilCapable'] = False
            if 'oilResource' not in region:
                region['oilResource'] = False
            if 'coreEco' not in region:
                region['coreEco'] = False

        # Write the fixed JSON back to the file, located in the current directory
        out_file = os.path.join(base_dir, 'TIRegionTemplate_fixed.json')
        with open(out_file, 'w') as out_f:
            json.dump(data, out_f, indent=2)
        print(f"Fixed JSON written to {out_file}")
        
if __name__ == "__main__":
    main()