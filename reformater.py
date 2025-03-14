import yaml
import json

# Load the YAML file (assumes the file is named 'devices.yaml')
with open('ios_devices.yaml', 'r') as file:
    data = yaml.safe_load(file)
    print (data)
# 'data' is expected to be a dict with a key "devices"
devices = data.get("devices", {})
print(devices)

# Create a list to hold the converted device dictionaries
converted_devices = []

for device_name, device_info in devices.items():
    print(device_name)
    # Remove the "Aspect Ratio:" artifact from the aspect_ratio value if present
    if "aspect_ratio" in device_info and isinstance(device_info["aspect_ratio"], str):
        device_info["aspect_ratio"] = device_info["aspect_ratio"].replace("Aspect Ratio:", "").strip()
    
    # Remove the "Release Date:" artifact from the release_date value if present
    if "release_date" in device_info and isinstance(device_info["release_date"], str):
        device_info["release_date"] = device_info["release_date"].replace("Release Date:", "").strip()
    
    # Optionally add the device name into the dictionary (if you need it in the JSON)
    device_info["device"] = device_name
    
    # Append the cleaned device info to the list
    converted_devices.append(device_info)

# Save the converted data to a JSON file (e.g., 'devices.json')
with open('devices.json', 'w') as json_file:
    json.dump(converted_devices, json_file, indent=2)

print("Conversion complete. JSON file 'devices.json' created.")
