const fs = require('fs');

// Load devices from devices.json file
const devices = JSON.parse(fs.readFileSync('devices.json', 'utf8'));

/**
 * Filters devices by screen_diagonal within a specified tolerance.
 * @param {Array<Object>} devices - Array of device objects.
 * @param {number} targetDiagonal - The target screen diagonal value.
 * @param {number} [tolerance=0] - Tolerance range (default 0).
 * @returns {Array<Object>} - Array of matching devices.
 */
function filterDevicesByScreenDiagonal(devices, targetDiagonal, tolerance = 0) {
  return devices.filter(device => {
    const diagonal = Number(device.screen_diagonal);
    return Math.abs(diagonal - targetDiagonal) <= tolerance;
  });
}

/**
 * Filters devices by an exact scale_factor match.
 * @param {Array<Object>} devices - Array of device objects.
 * @param {number} scaleFactor - The scale factor to match.
 * @returns {Array<Object>} - Array of matching devices.
 */
function filterDevicesByScaleFactor(devices, scaleFactor) {
  return devices.filter(device => device.scale_factor === scaleFactor);
}

/**
 * Filters devices by logical dimensions (logical_width and logical_height)
 * within a specified tolerance. This function handles orientation cases by
 * checking both the normal and the flipped (swapped) orientations.
 * @param {Array<Object>} devices - Array of device objects.
 * @param {number} targetWidth - The target logical width.
 * @param {number} targetHeight - The target logical height.
 * @param {number} [tolerance=0] - Tolerance for both dimensions (default 0).
 * @returns {Array<Object>} - Array of matching devices.
 */
function filterDevicesByLogicalDimensions(devices, targetWidth, targetHeight, tolerance = 0) {
  return devices.filter(device => {
    const width = Number(device.logical_width);
    const height = Number(device.logical_height);
    // Check normal orientation and flipped orientation
    const normalMatch = Math.abs(width - targetWidth) <= tolerance &&
                        Math.abs(height - targetHeight) <= tolerance;
    const flippedMatch = Math.abs(width - targetHeight) <= tolerance &&
                         Math.abs(height - targetWidth) <= tolerance;
    return normalMatch || flippedMatch;
  });
}

// --- Example Usage ---
// Define target values
const targetDiagonal = 6.68;    // Example target screen diagonal
const targetScaleFactor = 3.0;  // Example target scale factor
const targetLogicalWidth = 428; // Example target logical width
const targetLogicalHeight = 926; // Example target logical height

// Optional tolerances default to zero if not provided
const diagonalTolerance = 0; 
const logicalTolerance = 0; 

// Apply filters in sequence
let filteredDevices = filterDevicesByScreenDiagonal(devices, targetDiagonal, diagonalTolerance);
filteredDevices = filterDevicesByScaleFactor(filteredDevices, targetScaleFactor);
filteredDevices = filterDevicesByLogicalDimensions(filteredDevices, targetLogicalWidth, targetLogicalHeight);

// Return only the device names
const deviceNames = filteredDevices.map(device => device.device);

console.log("Filtered devices (device names):");
console.log(deviceNames);
