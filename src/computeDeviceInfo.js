/**
 * Checks if the device is a true Mac.
 * It checks navigator.platform and uses navigator.maxTouchPoints to exclude touch devices.
 * @returns {boolean} - True if the device is a Mac, false otherwise.
 */
export function isMacDevice() {
    let platformInfo = "";
    if (navigator.userAgentData && navigator.userAgentData.platform) {
      platformInfo = navigator.userAgentData.platform;
    } else if (navigator.platform) {
      platformInfo = navigator.platform;
    } else {
      platformInfo = navigator.userAgent;
    }
    const isMac = platformInfo.toLowerCase().includes("mac");
    return isMac && (navigator.maxTouchPoints === 0 || navigator.maxTouchPoints === 1);
  }
  
  /**
   * Fetch and parse the JSON file containing device specs.
   * Selects the JSON file based on device type.
   * @param {string} deviceType - "mac" or "mobile" (default: "mobile")
   * @returns {Promise<Array<Object>>} - Parsed JSON data
   */
  export async function fetchDeviceData(deviceType = "mobile") {
    const jsonUrl =
      deviceType === "mac"
        ? "data/mac_with_screens_devices.json"
        : "data/apple_mobile_devices.json";
    const response = await fetch(jsonUrl);
    const jsonData = await response.json();
    return jsonData;
  }
  
  /**
   * Extracts all available User-Agent Client Hints data using the modern userAgentData API.
   * @returns {Promise<Object|null>} - The combined UA data object or null if not supported.
   */
  export async function extractSecUA() {
    if (navigator.userAgentData) {
      const lowEntropyData = {
        brands: navigator.userAgentData.brands || null,
        mobile: navigator.userAgentData.mobile || null,
        platform: navigator.userAgentData.platform || null
      };
  
      if (typeof navigator.userAgentData.getHighEntropyValues === "function") {
        try {
          const highEntropyData = await navigator.userAgentData.getHighEntropyValues([
            "architecture",
            "bitness",
            "model",
            "platformVersion",
            "uaFullVersion",
            "fullVersionList"
          ]);
          return { ...lowEntropyData, ...highEntropyData };
        } catch (error) {
          console.error("Error fetching high-entropy UA data:", error);
          return lowEntropyData;
        }
      }
      return lowEntropyData;
    }
    return null;
  }
  
  /**
   * Checks the display's color gamut using CSS media queries.
   * @returns {string} - The detected color gamut.
   */
  export function checkColorGamut() {
    if (window.matchMedia("(color-gamut: p3)").matches) {
      return "P3";
    } else if (window.matchMedia("(color-gamut: srgb)").matches) {
      return "sRGB";
    } else {
      return "Unknown";
    }
  }
  
/**
 * Returns screen dimensions and computes physical dimensions, assumed PPI, and screen diagonal.
 * @param {boolean} isMac - Whether the device is a Mac device.
 * @returns {Object} - An object containing:
 *   - logicalWidth: number,
 *   - logicalHeight: number,
 *   - scaleFactor: number,
 *   - physicalWidth: number,
 *   - physicalHeight: number,
 *   - assumedPPI: number,
 *   - computedDiagonalInches: number.
 */
export function getScreenInfo(isMac) {
    // Get logical dimensions (points) and scale factor.
    const logicalWidth = window.screen.width;
    const logicalHeight = window.screen.height;
    const scaleFactor = window.devicePixelRatio || 1;
  
    // Compute physical dimensions (pixels).
    const physicalWidth = Math.round(logicalWidth * scaleFactor);
    const physicalHeight = Math.round(logicalHeight * scaleFactor);
  
    // Get the assumed PPI and compute screen diagonal.
    const assumedPPI = getAssumedPPI(isMac, physicalWidth);
    const computedDiagonalInches = computeScreenDiagonal(
      physicalWidth,
      physicalHeight,
      assumedPPI
    );
  
    return {
      logicalWidth,
      logicalHeight,
      scaleFactor,
      physicalWidth,
      physicalHeight,
      assumedPPI,
      computedDiagonalInches
    };
  }

  /**
   * Returns an assumed PPI based on device type and physical width.
   * @param {boolean} isMac - Whether the device is a Mac.
   * @param {number} physicalWidth - The physical width of the device screen in pixels.
   * @returns {number} - The assumed PPI.
   */
  export function getAssumedPPI(isMac, physicalWidth) {
    const ua = navigator.userAgent;
    if (ua.includes("iPad")) {
      console.log("iPad");
      return 264;
    } else if (ua.includes("iPhone")) {
      console.log("iPhone");
      if (window.devicePixelRatio === 3) {
        return 460;
      } else {
        return 326;
      }
    } else if (isMac) {
      if (physicalWidth < 2700) {
        console.log("mac");
        return 227;
      } else if (physicalWidth < 3000) {
        console.log("3k mac");
        return 220;
      } else {
        console.log("other mac");
        return 226;
      }
    } else {
      return 96;
    }
  }
  
  /**
   * Computes the screen diagonal (in inches) using physical dimensions and an assumed PPI.
   * @param {number} physicalWidth - The physical width in pixels.
   * @param {number} physicalHeight - The physical height in pixels.
   * @param {number} assumedPPI - The assumed pixels per inch.
   * @returns {number} - The computed screen diagonal in inches.
   */
  export function computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI) {
    const diagonalPixels = Math.sqrt(physicalWidth ** 2 + physicalHeight ** 2);
    return diagonalPixels / assumedPPI;
  }
  
  /**
   * Measures the frame rate over a specified duration.
   * @param {number} duration - Duration in milliseconds (default: 1000).
   * @returns {Promise<number>} - The measured frames per second.
   */
  export function measureFrameRate(duration = 1000) {
    return new Promise((resolve) => {
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
  
  /**
   * Detects ProMotion display by measuring the frame rate.
   * @returns {Promise<number>} - The measured frame rate.
   */
  export async function detectProMotion() {
    const fps = await measureFrameRate(1000);
    return +fps.toFixed(2);
  }
  



/**
 * Parse a WebGL unmasked renderer string into its components.
 *
 * Expected ANGLE string format:
 *   "ANGLE (Vendor, ANGLE Type: GPU Model, GPU Version)"
 * or
 *   "ANGLE (Vendor, ANGLE Type, GPU Model, GPU Version)"
 *
 * For non-ANGLE strings, a basic fallback is provided.
 *
 * @param {string} rendererString - The unmasked renderer string.
 * @returns {object} An object with keys: vendor, angleType, gpu, gpuVersion.
 */
function parseRendererInfo(rendererString) {
    const result = {
      vendor: '',
      angleType: '',
      gpu: '',
      gpuVersion: ''
    };
  
    if (rendererString.startsWith("ANGLE")) {
      // Regex breakdown:
      // ^ANGLE\s*\(         --> Matches "ANGLE (" with optional spaces.
      // ([^,]+),            --> Captures the GPU vendor until the first comma.
      // \s*([^,]+)          --> Captures the ANGLE type until the next comma.
      // (?:\s*:\s*([^,]+))?  --> Optionally captures the GPU model if a colon is present.
      // ,\s*([^,]+)         --> Captures the GPU version (possibly with a leading "Version" prefix).
      // \s*\)$              --> Matches the closing parenthesis.
      const regex = /^ANGLE\s*\(\s*([^,]+),\s*([^,]+)(?:\s*:\s*([^,]+))?,\s*([^,]+)\s*\)$/;
      const match = rendererString.match(regex);
      if (match) {
        result.vendor = match[1].trim();
        result.angleType = match[2].trim();
        result.gpu = match[3] ? match[3].trim() : "";
        result.gpuVersion = match[4].trim().replace(/^Version\s+/i, "");
  
        // If the GPU model starts with "Metal Renderer:", remove that prefix.
        if (result.gpu) {
          result.gpu = result.gpu.replace(/^Metal Renderer:\s*/i, "");
        }
        
        // If GPU model is not provided, infer it from the ANGLE type.
        if (!result.gpu && result.angleType) {
          result.gpu = result.angleType.replace(/^ANGLE\s*/i, '').trim();
          result.gpu = result.gpu.replace(/^Metal Renderer:\s*/i, "").trim();
        }
        return result;
      }
    }
    
    // Fallback for non-ANGLE strings (e.g., "Mesa DRI Intel(R) HD Graphics 520")
    const vendors = ["Intel", "AMD", "NVIDIA", "Apple"];
    for (let vendor of vendors) {
      if (rendererString.indexOf(vendor) !== -1) {
        result.vendor = vendor;
        break;
      }
    }
    result.gpu = rendererString;
    return result;
  }
  
  /**
   * Retrieve GPU info via WebGL and parse it.
   * @returns {object} An object with keys: WEBGL_MASKED, vendor, angleType, gpu, gpuVersion.
   */
  export function getParsedGPUInfo() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    let rendererString = "";
    let WEBGL_MASKED = true;
  
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        rendererString = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        WEBGL_MASKED = false;
      } else {
        const vendor = gl.getParameter(gl.VENDOR);
        const renderer = gl.getParameter(gl.RENDERER);
        rendererString = `${renderer} (${vendor})`;
      }
    } else {
      rendererString = "Unknown GPU";
    }
    
    const parsedInfo = parseRendererInfo(rendererString);
    return { WEBGL_MASKED, ...parsedInfo };
  }
  

/**
 * Initializes WebGPU by requesting an adapter and a device.
 * @returns {Promise<Object>} - An object indicating success or failure, and details.
 */
export async function initializeWebGPU() {
    let gpuDevice = null;
  
    if (!("gpu" in navigator)) {
      return { success: false, error: "User agent doesn’t support WebGPU." };
    }
  
    try {
      const gpuAdapter = await navigator.gpu.requestAdapter();
  
      if (!gpuAdapter) {
        return { success: false, error: "No WebGPU adapters found." };
      }
  
      gpuDevice = await gpuAdapter.requestDevice();
  
      gpuDevice.lost.then((info) => {
        console.error(`WebGPU device was lost: ${info.message}`);
        gpuDevice = null;
        if (info.reason !== "destroyed") {
          initializeWebGPU(); // Attempt to reinitialize
        }
      });
  
      // Assuming the adapter has an 'info' property (this may depend on your implementation)
      return {
        success: true,
        adapterName: gpuAdapter.name || "Unknown",
        features: Array.from(gpuAdapter.features),
        limits: gpuAdapter.limits,
        adapterType: {
          info: {
            vendor: gpuAdapter.info?.vendor || "N/A",
            architecture: gpuAdapter.info?.architecture || "N/A",
            device: gpuAdapter.info?.device || "N/A",
            description: gpuAdapter.info?.description || "N/A"
          }
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  

  /**
 * Asynchronously enumerates available video input devices (cameras) and logs their details.
 * @returns {Promise<number>} A promise that resolves with the number of video devices found.
 */
export async function getCameraCount() {
   try {
    // 1. Request camera permission
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    
    // 2. Enumerate devices after permission is granted
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    console.log(`Found ${videoDevices.length} video input devices.`);
    
    videoDevices.forEach((device, index) => {
      console.log(`Camera ${index + 1}: ${device.label || 'Unnamed Camera'}`);
    });
    
    // Stop the stream to turn off the camera
    stream.getTracks().forEach(track => track.stop());
    
    return videoDevices.length;
    
  } catch (err) {
    console.error('Error getting camera count:', err);
    throw err;
  }
}