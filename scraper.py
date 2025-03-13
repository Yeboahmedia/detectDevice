import requests
from bs4 import BeautifulSoup
import yaml
import re  # Import regex for cleaning numeric values

# URL of the website containing iOS resolution data
URL = "https://www.ios-resolution.com/"

# Function to extract numeric values from strings (e.g., "Screen Diagonal: 8.3" → 8.3)
def extract_number(text):
    match = re.search(r"\d+(\.\d+)?", text)  # Find first integer or decimal
    return float(match.group()) if match else None  # Return as float if found

# Function to scrape data from the website
def scrape_ios_devices():
    response = requests.get(URL)
    if response.status_code != 200:
        print("Failed to retrieve the webpage")
        return None

    soup = BeautifulSoup(response.text, "html.parser")

    # Find the table containing device resolutions
    table = soup.find("table")
    if not table:
        print("Could not find the device table on the webpage.")
        return None

    devices = {}

    # Extract table headers
    headers = [th.text.strip() for th in table.find_all("th")]

    # Process each row in the table
    for row in table.find_all("tr")[1:]:  # Skipping the header row
        columns = row.find_all("td")
        if not columns or len(columns) < len(headers):
            continue  # Skip invalid rows

        # Extract device name
        model_name = columns[0].text.strip()

        # Extract relevant details, cleaning numeric values
        devices[model_name] = {
            "logical_width": extract_number(columns[1].text.strip()),
            "logical_height": extract_number(columns[2].text.strip()),
            "physical_width": extract_number(columns[3].text.strip()),
            "physical_height": extract_number(columns[4].text.strip()),
            "ppi": extract_number(columns[5].text.strip()),
            "scale_factor": extract_number(columns[6].text.strip()),
            "screen_diagonal": extract_number(columns[7].text.strip()),  # Fixed extraction
            "aspect_ratio": columns[8].text.strip(),
            "release_date": columns[9].text.strip(),
            'gpu': "unknown",
            'pro-motion': False,
            "unique": False  # Default value, can be updated later if needed
        }

        # devices.append(device_data)

    return devices

# Function to save data to a YAML file
def save_to_yaml(devices, filename="ios_devices.yaml"):
    with open(filename, "w") as file:
        yaml.dump({"devices": devices}, file, default_flow_style=False, allow_unicode=True)

# Run the scraper and save results
if __name__ == "__main__":
    ios_devices = scrape_ios_devices()
    if ios_devices:
        save_to_yaml(ios_devices)
        print(f"✅ Successfully saved {len(ios_devices)} devices to ios_devices.yaml")
    else:
        print("❌ Failed to scrape data")
