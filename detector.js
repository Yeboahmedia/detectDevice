(async function() {
  // Dynamically import the GPU parser module.
  // Adjust the path ('./gpuParser.js') as needed.
  const gpuParserModule = await import('./gpuParser.js');
  const parseDevicesModule = await import('./DeviceParser.js');
  const { getParsedGPUInfo } = gpuParserModule;
  const { parseDevices } = parseDevicesModule

  
  // Fetch and parse the JSON file containing device specs
  async function fetchDeviceData() {
    const response = await fetch("apple_mobile_device.json");
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
  const diagonalTolerance = 0.005; 
  const logicalTolerance = 0; 

  // -------------------------
  // Computation on device
  // -------------------------
  async function detectAppleDevice() {
    // Get logical dimensions (points) and scale factor
    const logicalWidth = window.screen.width;
    const logicalHeight = window.screen.height;
    const scaleFactor = window.devicePixelRatio || 1;
    
    // Compute physical dimensions (pixels)
    const physicalWidth = Math.round(logicalWidth * scaleFactor);
    const physicalHeight = Math.round(logicalHeight * scaleFactor);
    
    // Get an assumed PPI based on the user agent (for screen diagonal calculation)
    function getAssumedPPI() {
      const ua = navigator.userAgent;
      if (ua.includes("iPad")) {
        return 264;
      } else if (ua.includes("iPhone")) {
        return 460;
      } else if (ua.includes("Macintosh")) {
        return 220;
      } else {
        return 96;
      }
    }

    // Compute screen diagonal (in inches) using physical dimensions and an assumed PPI
    function computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI) {
      const diagonalPixels = Math.sqrt(physicalWidth ** 2 + physicalHeight ** 2);
      return diagonalPixels / assumedPPI;
    }

    // Get assumed PPI and compute screen diagonal (in inches) and in mm
    const assumedPPI = getAssumedPPI();
    const computedDiagonalInches = computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI);
    const computedDiagonalMM = computedDiagonalInches * 25.4;
  
    // Get and parse GPU info from the dynamically imported module.
    // This returns an object like:
    // { WEBGL_MASKED, vendor, angleType, gpu, gpuVersion }
    const parsedGPUInfo = getParsedGPUInfo();
  
    const resolutionStr = `${logicalWidth} x ${logicalHeight} (Scale: ${scaleFactor})`;

    // Measure the actual frame rate over a given duration (ms)
    function measureFrameRate(duration = 1000) {
      return new Promise(resolve => {
        let frameCount = 0;
        const startTime = performance.now();
        function frame() {
          frameCount++;
          const elapsed = performance.now() - startTime;
          if (elapsed < duration) {
            requestAnimationFrame(frame);
          } else {
            const fps = frameCount / (elapsed / 1000);
            resolve(fps);
          }
        }
        requestAnimationFrame(frame);
      });
    }

    // Determine ProMotion support by measuring FPS (threshold ~100Hz indicates ProMotion)
    async function detectProMotion() {
      const fps = await measureFrameRate(1000);
      return +fps.toFixed(2);
    }

    let measuredProMotion = await detectProMotion();
    const promotionStr = measuredProMotion;

    // Apply filters in sequence
    let filteredDevices = filterDevicesByScreenDiagonal(devices, computedDiagonalInches, diagonalTolerance);
    console.log(filteredDevices);
    filteredDevices = filterDevicesByScaleFactor(filteredDevices, scaleFactor);
    filteredDevices = filterDevicesByLogicalDimensions(filteredDevices, logicalWidth, logicalHeight, logicalTolerance);
    
    // Return only the device names
    let deviceNames = filteredDevices.map(device => device.device);
    deviceNames = parseDevices(deviceNames);

  
    // Update UI elements on the page, including candidate lists and diagonal values
    function updateUI(deviceName, resolution, diagonalInches, diagonalMM, gpuInfo) {
      document.getElementById("device-name").innerText = deviceName;
      document.getElementById("screen-size").innerText = resolution;
      document.getElementById("screen-diagonal").innerText = diagonalInches.toFixed(2) + " inches";
      document.getElementById("screen-diagonal-mm").innerText = diagonalMM.toFixed(2) + " mm";
      
      const gpuText = gpuInfo.gpu ;
      
      document.getElementById("gpu-info").innerText = gpuText;
      document.getElementById("promotion").innerText = promotionStr;
    }

    updateUI(deviceNames, resolutionStr, computedDiagonalInches, computedDiagonalMM, parsedGPUInfo);
  }

  // Call detectAppleDevice (or any other function that starts your process)
  detectAppleDevice();
})();
