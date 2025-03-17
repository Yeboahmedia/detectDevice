(async function() {
  // Dynamically import the GPU parser module.
  const gpuParserModule = await import('./src/gpuParser.js');
  const parseDevicesModule = await import('./src/DeviceParser.js');
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
    // return isMac && (navigator.maxTouchPoints === 0 || navigator.maxTouchPoints === 1);
    return false;
  }
  
  /**
   * Fetch and parse the JSON file containing device specs.
   * Selects the JSON file based on device type.
   * @param {string} deviceType - "mac" or "mobile" (default: "mobile")
   * @returns {Promise<Array<Object>>} - Parsed JSON data
   */
  async function fetchDeviceData(deviceType = "mobile") {
    const jsonUrl = deviceType === "mac" 
                    ? "data/mac_with_screens_devices.json" 
                    : "data/apple_mobile_devices.json";
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
  
  // Tolerance values.
  const diagonalTolerance = 0.04; 
  const logicalTolerance = 0; 

  /**
   * Extracts all available User-Agent Client Hints data using the modern userAgentData API.
   * If supported, returns an object with both low-entropy and high-entropy fields.
   * Otherwise, returns null.
   *
   * @returns {Promise<Object|null>} - The combined UA data object or null if not supported.
   */
  async function extractSecUA() {
    if (navigator.userAgentData) {
      // Gather low-entropy values.
      const lowEntropyData = {
        brands: navigator.userAgentData.brands || null,
        mobile: navigator.userAgentData.mobile || null,
        platform: navigator.userAgentData.platform || null
      };

      // Request high-entropy values if supported.
      if (typeof navigator.userAgentData.getHighEntropyValues === 'function') {
        try {
          const highEntropyData = await navigator.userAgentData.getHighEntropyValues([
            'architecture',
            'bitness',
            'model',
            'platformVersion',
            'uaFullVersion',
            'fullVersionList'
          ]);
          return { ...lowEntropyData, ...highEntropyData };
        } catch (error) {
          console.error('Error fetching high-entropy UA data:', error);
          return lowEntropyData;
        }
      }
      return lowEntropyData;
    }
    return null;
  }
  
  // -------------------------
  // New function to check color gamut.
  // -------------------------
  /**
   * Checks the display's color gamut using CSS media queries.
   * @returns {string} - The detected color gamut.
   */
  function checkColorGamut() {
    if (window.matchMedia("(color-gamut: p3)").matches) {
      return "P3";
    } else if (window.matchMedia("(color-gamut: srgb)").matches) {
      return "sRGB";
    } else {
      return "Unknown";
    }
  }
  
  // -------------------------
  // Main detection logic.
  // -------------------------
  async function detectAppleDevice() {
    // Determine if the device is a Mac using the revised function.
    const isMac = isMacDevice();
    // Fetch device specs from the appropriate JSON file.
    const devices = await fetchDeviceData(isMac ? "mac" : "mobile");

    // Get logical dimensions (points) and scale factor.
    const logicalWidth = window.screen.width;
    const logicalHeight = window.screen.height;
    const scaleFactor = window.devicePixelRatio || 1;
    
    // Compute physical dimensions (pixels).
    const physicalWidth = Math.round(logicalWidth * scaleFactor);
    const physicalHeight = Math.round(logicalHeight * scaleFactor);
    
    /**
     * Updated assumed PPI calculation.
     *
     * - For iPad: returns 264.
     * - For iPhone: uses devicePixelRatio to differentiate:
     *     - DPR of 3: returns 460 (e.g., iPhone X/XS).
     *     - DPR of 2: returns 326 (e.g., iPhone XR, 11, 8, SE).
     * - For Macs: uses existing heuristics.
     * - Otherwise: defaults to 96.
     */
    function getAssumedPPI() {
      const ua = navigator.userAgent;
      if (ua.includes("iPad")) {
        console.log('iPad');
        return 264;
      } else if (ua.includes("iPhone")) {
        console.log('iPhone');
        if (window.devicePixelRatio === 3) {
          return 460;
        } else {
          return 326;
        }
      } else if (isMac) {
        if (physicalWidth < 2700) {
          console.log('mac');
          return 227;
        } else if (physicalWidth < 3000) {
          console.log('3k mac');
          return 220;
        } else {
          console.log('other mac');
          return 226;
        }
      } else {
        return 96;
      }
    }

    // Compute screen diagonal (in inches) using physical dimensions and an assumed PPI.
    function computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI) {
      const diagonalPixels = Math.sqrt(physicalWidth ** 2 + physicalHeight ** 2);
      return diagonalPixels / assumedPPI;
    }
    
    const assumedPPI = getAssumedPPI();
    const computedDiagonalInches = computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI);
    const computedDiagonalMM = computedDiagonalInches * 25.4;
  
    // Parse GPU info.
    const parsedGPUInfo = getParsedGPUInfo();
    const resolutionStr = `${logicalWidth} x ${logicalHeight} (Scale: ${scaleFactor})`;

    // Measure frame rate for ProMotion detection.
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

    // Filter sequentially: logical dimensions -> scale factor -> screen diagonal -> color gamut.
    let filteredDevices = [];
    if (isMac) {
      filteredDevices = filterDevicesByLogicalDimensions(devices, logicalWidth, logicalHeight, logicalTolerance);
      filteredDevices = filterDevicesByScaleFactor(filteredDevices, scaleFactor);
    } else {
      // First, filter by logical dimensions.
      const logicalFiltered = filterDevicesByLogicalDimensions(devices, logicalWidth, logicalHeight, logicalTolerance);
      console.log("Logical Filter:", logicalFiltered);

      // Next, filter by scale factor.
      const scaleFiltered = filterDevicesByScaleFactor(logicalFiltered, scaleFactor);
      console.log("Scale Filter:", scaleFiltered);

      // Then, filter by screen diagonal.
      const screenFiltered = filterDevicesByScreenDiagonal(scaleFiltered, computedDiagonalInches, diagonalTolerance);
      console.log("Screen Diagonal Filter:", screenFiltered);
      
      // Fallback: if screen diagonal filtering returns an empty array but scaleFiltered is non-empty, use scaleFiltered.
      filteredDevices = (screenFiltered.length > 0) ? screenFiltered : scaleFiltered;
      
      // Finally, filter by color gamut.
      const colorGamutInfo = checkColorGamut();
      filteredDevices = filterDevicesByColorGamut(filteredDevices, colorGamutInfo);
      console.log("Color Gamut Filter:", filteredDevices, colorGamutInfo);
    }

    // Extract device names and parse them.
    let deviceNames = filteredDevices.map(device => device.device);
    deviceNames = parseDevices(deviceNames);
  
    // Extract all available UA data.
    const uaData = await extractSecUA();
    // Format the UA data for display.
    let uaInfoDisplay = "N/A";
    if (uaData) {
      uaInfoDisplay = Object.entries(uaData)
        .map(([key, value]) => {
          // For objects or arrays, stringify the content.
          if (typeof value === 'object' && value !== null) {
            return `${key}: ${JSON.stringify(value)}`;
          }
          return `${key}: ${value}`;
        })
        .join(', ');
    }
  
    // Check the display's color gamut.
    const colorGamutDisplay = checkColorGamut();
  
    // Update UI.
    function updateUI(deviceName, resolution, diagonalInches, diagonalMM, gpuInfo, uaInfo, colorGamut) {
      document.getElementById("device-name").innerText = deviceName;
      document.getElementById("screen-size").innerText = resolution;
      document.getElementById("screen-diagonal").innerText = diagonalInches.toFixed(2) + " inches";
      document.getElementById("screen-diagonal-mm").innerText = diagonalMM.toFixed(2) + " mm";
      document.getElementById("gpu-info").innerText = gpuInfo.gpu;
      document.getElementById("promotion").innerText = promotionStr;
      document.getElementById("sec-ua-info").innerText = uaInfo;
      // New element update for color gamut.
      document.getElementById("color-gamut").innerText = colorGamut;
    }
  
    updateUI(deviceNames, resolutionStr, computedDiagonalInches, computedDiagonalMM, parsedGPUInfo, uaInfoDisplay, colorGamutDisplay);
  }
  
  // Start detection.
  detectAppleDevice();
})();
