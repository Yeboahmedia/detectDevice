const fs = require('fs');

// Load devices from devices.json file
const devices = JSON.parse(fs.readFileSync('devices.json', 'utf8'));

/**
 * Finds device names whose screen_diagonal is within the specified tolerance.
 * @param {Array<Object>} devices - Array of device objects.
 * @param {number} targetDiagonal - The target screen diagonal value.
 * @param {number} [tolerance=0.05] - Tolerance range (default 0.05).
 * @returns {Array<string>} - Array of matching device names.
 */
function findDeviceNamesByScreenDiagonal(devices, targetDiagonal, tolerance = 0) {
  return devices
    .filter(device => {
      const diagonal = Number(device.screen_diagonal);
      return Math.abs(diagonal - targetDiagonal) <= tolerance;
    })
    .map(device => device.device);
}

// Example usage:
const target = 6.1;
const matchingDeviceNames = findDeviceNamesByScreenDiagonal(devices, target);

console.log(`Device names matching screen_diagonal ${target} ±0.05:`);
console.log(matchingDeviceNames);
