import json
import re

def convert_screen_diagonal(diagonal_str):
    """
    Extracts a float from a screen diagonal string.
    E.g., "16.2\"" becomes 16.2.
    """
    # Use regex to capture the numeric portion (including decimals)
    match = re.search(r"([\d\.]+)", diagonal_str)
    if match:
        return float(match.group(1))
    else:
        raise ValueError(f"Cannot convert screen diagonal value: {diagonal_str}")

def reformat_json_file(input_filename, output_filename):
    # Load JSON data from input file
    with open(input_filename, 'r') as infile:
        data = json.load(infile)
    
    # Process each device in the data list
    for device in data:
        if "Screen Diagonal" in device:
            original_value = device["Screen Diagonal"]
            try:
                # Convert the string value to a float
                device["Screen Diagonal"] = convert_screen_diagonal(original_value)
            except ValueError as e:
                print(f"Warning: {e}")
    
    # Write the updated data to output file with pretty-printing
    with open(output_filename, 'w') as outfile:
        json.dump(data, outfile, indent=2)
    
    print(f"Reformatted JSON data has been written to {output_filename}")

if __name__ == "__main__":
    input_file = "mac_devices.json"    # Replace with your actual input file name
    output_file = "mac_with_screens_devices.json"  # Replace with your desired output file name
    reformat_json_file(input_file, output_file)
