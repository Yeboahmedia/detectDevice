(async function() {
  // Fetch and parse the JSON file containing device specs
  async function fetchDeviceData() {
    const response = await fetch("devices.json");
    const jsonData = await response.json();
    return jsonData; // JSON is expected to be an array of device objects
  }
  
  // Fetch device specs from devices.json (which is an array)
  const devices = await fetchDeviceData(); // deviceData is an array

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

  // Optional tolerances default to zero if not provided
  const diagonalTolerance = 0; 
  const logicalTolerance = 0; 

  // -------------------------
  // computation on device
  // -------------------------
  async function detectAppleDevice() {
    // Get logical dimensions (points) and scale factor
    const logicalWidth = window.screen.width;
    const logicalHeight = window.screen.height;
    const scaleFactor = window.devicePixelRatio || 1;
    
    // Compute physical dimensions (pixels)
    const physicalWidth = Math.round(logicalWidth * scaleFactor);
    const physicalHeight = Math.round(logicalHeight * scaleFactor);
    
    // Compute aspect ratio (from physical dimensions)
    const computedAspect = computeAspectRatio(physicalWidth, physicalHeight);
    
    // Get assumed PPI and compute screen diagonal (in inches) and in mm
    const assumedPPI = getAssumedPPI();
    const computedDiagonalInches = computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI);
    const computedDiagonalMM = computedDiagonalInches * 25.4;
    
    // Get measured ProMotion support
    let measuredProMotion = await detectProMotion();
    const ua = navigator.userAgent;
    const isIOS = ua.includes("iPhone") || ua.includes("iPad");
    // (Optional: override measuredProMotion if needed on iOS)
    
    // Get GPU info
    const gpuRenderer = getGPUInfo();
    const resolutionStr = `${logicalWidth} x ${logicalHeight} (Scale: ${scaleFactor})`;
    const promotionStr = measuredProMotion ? "Yes (120Hz)" : "No";
  
    // Apply filters in sequence
    let filteredDevices = filterDevicesByScreenDiagonal(devices, computedDiagonalInches, diagonalTolerance);
    filteredDevices = filterDevicesByScaleFactor(filteredDevices, scaleFactor);
    filteredDevices = filterDevicesByLogicalDimensions(filteredDevices, logicalWidth, logicalHeight, logicalTolerance);
  
    // Return only the device names
    const deviceNames = filteredDevices.map(device => device.device);
  
    // Update UI
    updateUI(
      deviceNames,
      resolutionStr,
      computedDiagonalInches,
      computedDiagonalMM,
      gpuRenderer,
      promotionStr,
    );
  }

  // Call detectAppleDevice (or any other function that starts your process)
  detectAppleDevice();
})();
