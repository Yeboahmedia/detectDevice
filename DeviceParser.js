/**
 * Parses an input of Apple devices and groups similar ones.
 *
 * Supported categories include: "apple watch", "iphone", "ipad", "ipod", and "mac".
 * For each device, the function extracts a simplified detail:
 *  - For Mac devices, it returns the full product name and screen size (e.g. "MacBook Pro 14 inch").
 *  - For other devices, if the text after the category starts with a numeric token,
 *    the entire remainder is used (so "iphone 14 pro" becomes "14 pro").
 *  - Otherwise, the remaining text (after the category name) is trimmed and used.
 *
 * Devices that do not match any category are returned as-is.
 *
 * Examples:
 *   Input (string): "iphone XR | iphone 14 pro | iphone 15 pro | ipod touch | ipad pro | macbook air | apple watch series 3 | MacBook Pro (14-inch, 2023)"
 *
 *   Input (array): [
 *       "iphone XR", "iphone 14 pro", "iphone 15 pro", "ipod touch",
 *       "ipad pro", "macbook air", "apple watch series 3", "MacBook Pro (14-inch, 2023)"
 *   ]
 *
 *   Output (example): "iphone xr | 14 pro | 15 pro, ipod touch, ipad pro, macbook air, apple watch series 3, MacBook Pro 14 inch"
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
    if (categoryKey === 'mac') {
      // Custom extraction for Mac devices.
      // This regex tries to capture common Mac product names and their screen size.
      // It will match products like "MacBook Pro", "MacBook Air", or "iMac"
      // followed by any characters until a parenthesis containing a screen size.
      const macRegex = /(MacBook Pro|MacBook Air|iMac)[^()]*\(([\d]+)(?:-inch)?/i;
      const match = device.match(macRegex);
      if (match) {
        const productName = match[1].trim();
        const screenSize = match[2].trim();
        return `${productName} ${screenSize} inch`;
      }
      // Fallback: if the regex doesn't match, return the original device.
      return device;
    }
    // For non-Mac devices: remove the category keyword and use the remainder.
    const regex = new RegExp(categoryKey, 'i');
    let remainder = device.replace(regex, '').trim();
    // If remainder starts with a number, return the full remainder (e.g. "14 pro").
    if (/^\d+/.test(remainder)) {
      return remainder;
    }
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
      if (key === 'mac') {
        // For mac devices, output the full parsed names without prefixing "mac".
        resultParts.push(models.join(' | '));
      } else {
        resultParts.push(`${key} ${models.join(' | ')}`);
      }
    } else {
      resultParts.push(key);
    }
  }
  // Append any devices that did not match a category.
  resultParts.push(...others);

  return resultParts.join(', ');
}
