import json
from datetime import datetime

def add_color_gamut(device):
    """
    Add the color_gamut key based on the device's release date.
    Devices with a release year before 2016 get 'sRGB',
    and those from 2016 onward get 'P3'.
    """
    # Parse the release date assuming the format 'YYYY-MM-DD'
    release_date = datetime.strptime(device.get('release_date'), '%Y-%m-%d')
    
    # Check the year and update the device dictionary
    if release_date.year < 2016:
        device['color_gamut'] = "sRGB"
    else:
        device['color_gamut'] = "P3"
    return device


def update_keys(device):
    """
    change_promotion to refresh rate'. "pro-motion": false,
    """
    device['refresh_rate'] = device.pop('pro-motion')
    return device

def update_values(device):
    """
    change_promotion to refresh rate'. "pro-motion": false,
    """
    # Parse the release date assuming the format 'YYYY-MM-DD'
    refresh_rate = device.get('pro-motion')
    
    # Check the year and update the device dictionary
    if refresh_rate:
        device['refresh_rate'] = 120.0
    else:
        device['refresh_rate'] = 60.0
    return device

def main():
    # File paths (change these as needed)
    input_file = 'data/apple_mobile_devices.json'
    # input_file = 'data/mac_with_screens_devices.json'
    output_file = 'updated_devices.json'
    
    # Read the JSON file
    with open(input_file, 'r') as f:
        devices = json.load(f)
    
    # Process each device object to add the color_gamut key
    updated_devices = [update_values(device) for device in devices]
    
    # Write the updated list back to a new JSON file with pretty printing
    with open(output_file, 'w') as f:
        json.dump(updated_devices, f, indent=2)

if __name__ == '__main__':
    main()
