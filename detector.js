(async function() {
  // Dynamically import the GPU parser module.
  const gpuParserModule = await import('./gpuParser.js');
  const parseDevicesModule = await import('./DeviceParser.js');
  const { getParsedGPUInfo } = gpuParserModule;
  const { parseDevices } = parseDevicesModule;
  
  /**
   * Revised function to detect if the device is a true Mac.
   * It checks navigator.platform and uses navigator.maxTouchPoints to exclude touch devices.
   * @returns {boolean} - True if the device is a Mac, false otherwise.
   */
  function isMacDevice() {
    let platformInfo = "";
    
    // Use the modern userAgentData API if available.
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      platformInfo = navigator.userAgentData.platform;
    } else {
      // Fallback: use navigator.userAgent as a backup.
      platformInfo = navigator.userAgent;
    }
    
    // Check if the platform info indicates a macOS device.
    const isMac = /macintosh|mac os/i.test(platformInfo);
    
    // Exclude devices with multiple touch points (e.g., iPads).
    return isMac && (navigator.maxTouchPoints === 0 || navigator.maxTouchPoints === 1);
  }
  
  
  /**
   * Fetch and parse the JSON file containing device specs.
   * Selects the JSON file based on device type.
   * @param {string} deviceType - "mac" or "mobile" (default: "mobile")
   * @returns {Promise<Array<Object>>} - Parsed JSON data
   */
  async function fetchDeviceData(deviceType = "mobile") {
    const jsonUrl = deviceType === "mac" 
                    ? "mac_with_screens_devices.json" 
                    : "apple_mobile_devices.json";
    const response = await fetch(jsonUrl);
    const jsonData = await response.json();
    return jsonData;
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
  
  // Tolerance values
  const diagonalTolerance = 0.005; 
  const logicalTolerance = 0; 

  // -------------------------
  // Main detection logic
  // -------------------------
  async function detectAppleDevice() {
    // Determine if the device is a Mac using the revised function.
    const isMac = isMacDevice();
    // Fetch device specs from the appropriate JSON file.
    const devices = await fetchDeviceData(isMac ? "mac" : "mobile");

    // Get logical dimensions (points) and scale factor
    const logicalWidth = window.screen.width;
    const logicalHeight = window.screen.height;
    const scaleFactor = window.devicePixelRatio || 1;
    
    // Compute physical dimensions (pixels)
    const physicalWidth = Math.round(logicalWidth * scaleFactor);
    const physicalHeight = Math.round(logicalHeight * scaleFactor);
    
    // Updated assumed PPI calculation for Macs
    function getAssumedPPI() {
      const ua = navigator.userAgent;
      if (ua.includes("iPad")) {
        return 264;
      } else if (ua.includes("iPhone")) {
        return 460;
      } else if (isMac) {
        if (physicalWidth < 2700) {
          return 227;
        } else if (physicalWidth < 3000) {
          return 220;
        } else {
          return 226;
        }
      } else {
        return 96;
      }
    }

    // Compute screen diagonal (in inches) using physical dimensions and an assumed PPI
    function computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI) {
      const diagonalPixels = Math.sqrt(physicalWidth ** 2 + physicalHeight ** 2);
      return diagonalPixels / assumedPPI;
    }
    
    const assumedPPI = getAssumedPPI();
    const computedDiagonalInches = computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI);
    const computedDiagonalMM = computedDiagonalInches * 25.4;
  
    // Parse GPU info
    const parsedGPUInfo = getParsedGPUInfo();
    const resolutionStr = `${logicalWidth} x ${logicalHeight} (Scale: ${scaleFactor})`;

    // Measure frame rate for ProMotion detection
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
  
    async function detectProMotion() {
      const fps = await measureFrameRate(1000);
      return +fps.toFixed(2);
    }
  
    let measuredProMotion = await detectProMotion();
    const promotionStr = measuredProMotion;
  
    // Device filtering: For Macs, filter by logical dimensions first, then scale factor.
    let filteredDevices = [];
    if (isMac) {
      filteredDevices = filterDevicesByLogicalDimensions(devices, logicalWidth, logicalHeight, logicalTolerance);
      filteredDevices = filterDevicesByScaleFactor(filteredDevices, scaleFactor);
    } else {
      console.log('here');
      filteredDevices = filterDevicesByLogicalDimensions(devices, logicalWidth, logicalHeight, logicalTolerance);
      filteredDevices = filterDevicesByScaleFactor(filteredDevices, scaleFactor);
      console.log(filteredDevices);
      filteredDevices = filterDevicesByScreenDiagonal(devices, computedDiagonalInches, diagonalTolerance);

    }
    
    // Extract device names and parse them
    let deviceNames = filteredDevices.map(device => device.device);
    deviceNames = parseDevices(deviceNames);
  
    // Update UI
    function updateUI(deviceName, resolution, diagonalInches, diagonalMM, gpuInfo) {
      document.getElementById("device-name").innerText = deviceName;
      document.getElementById("screen-size").innerText = resolution;
      document.getElementById("screen-diagonal").innerText = diagonalInches.toFixed(2) + " inches";
      document.getElementById("screen-diagonal-mm").innerText = diagonalMM.toFixed(2) + " mm";
      document.getElementById("gpu-info").innerText = gpuInfo.gpu;
      document.getElementById("promotion").innerText = promotionStr;
    }
  
    updateUI(deviceNames, resolutionStr, computedDiagonalInches, computedDiagonalMM, parsedGPUInfo);
  }
  
  // Start detection
  detectAppleDevice();
})();
