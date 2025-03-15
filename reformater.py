import json

def format_device_data(device):
    """
    Transforms a device object from the provided format to the target format.
    
    Args:
      device (dict): The device object with original keys.
      
    Returns:
      dict: The device object with reformatted keys.
    """
    formatted = {
        "aspect_ratio": device.get("Aspect Ratio"),
        "gpu": device.get("GPU"),
        "logical_height": device.get("Logical Height"),
        "logical_width": device.get("Logical Width"),
        "physical_height": device.get("Physical Height"),
        "physical_width": device.get("Physical Width"),
        "ppi": device.get("PPI"),
        "pro-motion": device.get("ProMotion support"),
        "release_date": device.get("Release Date"),
        "scale_factor": device.get("Scale Factor"),
        "screen_diagonal": device.get("Screen Diagonal"),
        "unique": False,  # Always set unique to False as specified
        "device": device.get("Device Name")
    }
    return formatted

def main():
    # File paths for input and output JSON files.
    input_file = "mac_with_screens_devices.json"    # Change this if your source file is named differently
    output_file = "mac_with_screens_devices_2.json"   # Change this if you want a different output file name

    # Read the source JSON data from the input file.
    with open(input_file, "r", encoding="utf-8") as infile:
        data = json.load(infile)
    
    # Process the data:
    # - If the JSON file contains a list of devices, format each one.
    # - Otherwise, format the single device object.
    if isinstance(data, list):
        formatted_data = [format_device_data(device) for device in data]
    else:
        formatted_data = format_device_data(data)

    # Write the reformatted data to the output file.
    with open(output_file, "w", encoding="utf-8") as outfile:
        json.dump(formatted_data, outfile, indent=2)
    
    print(f"Formatted JSON has been written to {output_file}")

if __name__ == "__main__":
    main()
