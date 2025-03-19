/**
 * Applies an array of filter functions in sequence.
 * 
 * For depthSpec "Any":
 *   - It will apply each filter one after the other.
 *   - At the end, if the final filtered array is empty, it returns
 *     the most recent non-empty result.
 *
 * For depthSpec "Deep":
 *   - It returns only the result of the final filter.
 *
 * @param {Array} devices - The initial array of devices.
 * @param {Array<Function>} filters - Array of functions that accept and return an array.
 * @param {string} depthSpec - "Any" or "Deep".
 * @returns {Array} - The filtered array.
 */
function applyDynamicFilter(devices, filters, depthSpec) {
    let filtered = devices;
    // Keep track of the last non-empty result.
    let lastNonEmpty = devices;
  
    filters.forEach(filterFn => {
      filtered = filterFn(filtered);
      if (filtered.length > 0) {
        lastNonEmpty = filtered;
      }
    });
  
    // "Any": fallback to the most recent non-empty result if the final filter is empty.
    if (depthSpec === "Any") {
      return (filtered.length > 0) ? filtered : lastNonEmpty;
    }
    // "Deep": return the result of the final filter regardless.
    else if (depthSpec === "Deep") {
      return filtered;
    }
    // Fallback behavior if an unknown depth is provided.
    return filtered;
  }
  
  /**
   * Dynamically filters devices based on platform and a user-specified depth.
   *
   * For macOS:
   *   - Logical dimensions -> Scale factor -> Color gamut.
   *
   * For non-macOS:
   *   - Logical dimensions -> Scale factor -> Screen diagonal -> Color gamut.
   *
   * @param {Array} devices - The array of devices.
   * @param {boolean} isMac - Whether the current platform is macOS.
   * @param {string} depthSpec - "Any" or "Deep".
   * @param {number} logicalWidth 
   * @param {number} logicalHeight 
   * @param {number} logicalTolerance 
   * @param {number} scaleFactor 
   * @param {number} computedDiagonalInches 
   * @param {number} diagonalTolerance 
   * @returns {Array} - The filtered devices.
   */
 export function dynamicFilterDevices(devices, isMac, depthSpec, 
                                logicalWidth, logicalHeight, logicalTolerance, 
                                scaleFactor, computedDiagonalInches, diagonalTolerance, colorGamutInfo) {
    let filters = [];
  
    // First filter: logical dimensions.
    filters.push(devs => filterDevicesByLogicalDimensions(devs, logicalWidth, logicalHeight, logicalTolerance));
    // Second filter: scale factor.
    filters.push(devs => filterDevicesByScaleFactor(devs, scaleFactor));
  
    if (!isMac) {
      // Third filter (non-mac only): screen diagonal.
      filters.push(devs => filterDevicesByScreenDiagonal(devs, computedDiagonalInches, diagonalTolerance));
    }
    
    // Last filter: color gamut (applies to both platforms).
    // Note: checkColorGamut is assumed to return the required gamut info.
    filters.push(devs => filterDevicesByColorGamut(devs, colorGamutInfo));
  
    return applyDynamicFilter(devices, filters, depthSpec);
  }
  


    /**
   * Filters devices by logical dimensions (logical_width and logical_height)
   * within a specified tolerance.
   * Handles orientation by checking both normal and flipped dimensions.
   * @param {Array<Object>} devices - Array of device objects.
   * @param {number} targetWidth - Target logical width.
   * @param {number} targetHeight - Target logical height.
   * @param {number} [tolerance=0] - Tolerance (default 0).
   * @returns {Array<Object>} - Array of matching devices.
   */
    function filterDevicesByLogicalDimensions(devices, targetWidth, targetHeight, tolerance = 0) {
      return devices.filter(device => {
        const width = Number(device.logical_width);
        const height = Number(device.logical_height);
        const normalMatch = Math.abs(width - targetWidth) <= tolerance &&
                            Math.abs(height - targetHeight) <= tolerance;
        const flippedMatch = Math.abs(width - targetHeight) <= tolerance &&
                             Math.abs(height - targetWidth) <= tolerance;
        return normalMatch || flippedMatch;
      });
    }
    
    /**
     * Filters devices by an exact scale_factor match.
     * @param {Array<Object>} devices - Array of device objects.
     * @param {number} scaleFactor - Scale factor to match.
     * @returns {Array<Object>} - Array of matching devices.
     */
    function filterDevicesByScaleFactor(devices, scaleFactor) {
      return devices.filter(device => device.scale_factor === scaleFactor);
    }
    
    /**
     * Filters devices by screen_diagonal within a specified tolerance.
     * @param {Array<Object>} devices - Array of device objects.
     * @param {number} targetDiagonal - Target screen diagonal value.
     * @param {number} [tolerance=0] - Tolerance (default 0).
     * @returns {Array<Object>} - Array of matching devices.
     */
    function filterDevicesByScreenDiagonal(devices, targetDiagonal, tolerance = 0) {
      return devices.filter(device => {
        const diagonal = Number(device.screen_diagonal);
        return Math.abs(diagonal - targetDiagonal) <= tolerance;
      });
    }
    
    /**
     * Filters devices by the color gamut.
     * If a device has a "color_gamut" property, it must match the target gamut (case-insensitive).
     * Devices without this property are included.
     * @param {Array<Object>} devices - Array of device objects.
     * @param {string} targetGamut - Target color gamut (e.g., "P3" or "sRGB").
     * @returns {Array<Object>} - Array of matching devices.
     */
    function filterDevicesByColorGamut(devices, targetGamut) {
      return devices.filter(device => {
        if (device.hasOwnProperty("color_gamut") && device.color_gamut) {
          return device.color_gamut.toLowerCase() === targetGamut.toLowerCase();
        }
        // If no color_gamut key, include the device.
        return true;
      });
    }