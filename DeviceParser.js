/**
 * Parses an input of Apple devices and groups similar ones.
 *
 * Supported categories include: "apple watch", "iphone", "ipad", "ipod", and "mac".
 * For each device, the function extracts a simplified detail:
 *  - If a numeric token is present after the category (e.g., "14" in "iphone 14 pro"),
 *    that number is used.
 *  - Otherwise, the remaining text (after the category name) is trimmed and used.
 *
 * Devices that do not match any category are returned as-is.
 *
 * Examples:
 *   Input (string): "iphone XR | iphone 14 pro | iphone 15 pro | ipod touch | ipad pro | macbook air | apple watch series 3"
 *
 *   Input (array): [
 *       "iphone XR", "iphone 14 pro", "iphone 15 pro", "ipod touch",
 *       "ipad pro", "macbook air", "apple watch series 3"
 *   ]
 *
 *   Output: "iphone xr|14|15, ipod touch, ipad pro, mac  book air, apple watch series 3"
 *
 * @param {string | string[]} deviceInput - A string with device names separated by '|' or an array of device names.
 * @returns {string} The parsed device string with grouped models.
 */
export function parseDevices(deviceInput) {
  let devices;
  if (typeof deviceInput === 'string') {
    // If input is a string, split it by "|" and trim whitespace.
    devices = deviceInput.split('|').map(d => d.trim());
  } else if (Array.isArray(deviceInput)) {
    // If input is already an array, trim each device string.
    devices = deviceInput.map(d => d.trim());
  } else {
    throw new Error('Invalid input type. Expected a string or an array of strings.');
  }

  // Define device categories with corresponding regex patterns.
  // Order matters: more specific categories should come first.
  const categories = [
    { key: 'apple watch', pattern: /apple watch/i },
    { key: 'iphone', pattern: /iphone/i },
    { key: 'ipad', pattern: /ipad/i },
    { key: 'ipod', pattern: /ipod/i },
    { key: 'mac', pattern: /mac/i } // Matches macs, macbooks, imacs, etc.
  ];

  // Objects to group devices by category and store devices that don't match any category.
  const groups = {};
  const others = [];

  // Helper: extract a simplified model from the device string.
  function extractModel(device, categoryKey) {
    // Remove the category keyword (case-insensitive) from the device name.
    const regex = new RegExp(categoryKey, 'i');
    let remainder = device.replace(regex, '').trim();
    // Look for a numeric token.
    const numMatch = remainder.match(/\b(\d+)\b/);
    if (numMatch) {
      return numMatch[1];
    }
    // Return the remaining text in lowercase.
    return remainder.toLowerCase();
  }

  // Process each device.
  devices.forEach(device => {
    let matched = false;
    for (const cat of categories) {
      if (cat.pattern.test(device)) {
        matched = true;
        if (!groups[cat.key]) {
          groups[cat.key] = [];
        }
        groups[cat.key].push(extractModel(device, cat.key));
        break; // Stop after the first matching category.
      }
    }
    if (!matched) {
      others.push(device);
    }
  });

  // Remove duplicate model details in each group while preserving order.
  for (const key in groups) {
    groups[key] = groups[key].filter((item, pos, self) => self.indexOf(item) === pos);
  }

  // Construct the final result string.
  const resultParts = [];
  for (const key in groups) {
    // Filter out empty model details.
    const models = groups[key].filter(model => model !== '');
    if (models.length > 0) {
      resultParts.push(`${key} ${models.join('|')}`);
    } else {
      resultParts.push(key);
    }
  }
  // Append any devices that did not match a category.
  resultParts.push(...others);

  return resultParts.join(', ');
}


// Export using CommonJS syntax.