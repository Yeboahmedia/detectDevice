// Fetch and parse the YAML file containing device specs
async function fetchDeviceData() {
    const response = await fetch("ios_devices.yaml");
    const yamlText = await response.text();
    return parseYAML(yamlText);
  }
  
  // YAML Parser for structured device data with basic normalization
  function parseYAML(yamlText) {
    const lines = yamlText.split("\n").filter(line => line.trim() && !line.trim().startsWith("#"));
    let devices = {};
    let currentDevice = null;
    
    for (const line of lines) {
      if (/^[^\s].*:$/.test(line)) {
        // New device entry
        currentDevice = line.split(":")[0].trim();
        devices[currentDevice] = {};
      } else if (currentDevice) {
        const [key, ...valueParts] = line.trim().split(":");
        let value = valueParts.join(":").trim();
        // Normalize known keys: remove prefixes for aspect_ratio and release_date if present.
        if (key.trim().toLowerCase() === "aspect_ratio") {
          value = value.replace(/^(Aspect Ratio:)/i, "").trim();
        }
        if (key.trim().toLowerCase() === "release_date") {
          value = value.replace(/^(Release Date:)/i, "").trim();
        }
        // Convert numeric values when possible
        if (!isNaN(value)) {
          value = parseFloat(value);
        }
        // Convert boolean strings
        if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
          value = (value.toLowerCase() === "true");
        }
        devices[currentDevice][key.trim()] = value;
      }
    }
    return devices;
  }
  
  // Extract WebGL GPU information
  function getGPUInfo() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "Unknown GPU";
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Apple GPU";
  }
  
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
    return fps > 100;
  }
  
  // Compute aspect ratio as a decimal from two numbers
  function computeAspectRatio(width, height) {
    return width / height;
  }
  
  // Update UI elements
  function updateUI(deviceName, resolution, gpu, promotion, dynamicIsland, webglRenderer) {
    document.getElementById("device-name").innerText = deviceName;
    document.getElementById("screen-size").innerText = resolution;
    document.getElementById("gpu-info").innerText = gpu;
    document.getElementById("promotion").innerText = promotion;
    document.getElementById("dynamic-island").innerText = dynamicIsland;
    document.getElementById("webgl-renderer").innerText = webglRenderer;
  }
  
  // Main device detection function using all data points
  async function detectAppleDevice() {
    // Get logical dimensions and scale factor
    const logicalWidth = window.screen.width;
    const logicalHeight = window.screen.height;
    const scaleFactor = window.devicePixelRatio || 1;
    
    // Compute physical dimensions
    const physicalWidth = Math.round(logicalWidth * scaleFactor);
    const physicalHeight = Math.round(logicalHeight * scaleFactor);
    
    // Compute aspect ratio from physical dimensions (width/height)
    const computedAspect = computeAspectRatio(physicalWidth, physicalHeight);
    
    // Get measured ProMotion support
    const measuredProMotion = await detectProMotion();
    
    // Get WebGL GPU info (for additional refinement)
    const gpuRenderer = getGPUInfo();
    
    console.log(`Logical: ${logicalWidth}x${logicalHeight}`);
    console.log(`Physical: ${physicalWidth}x${physicalHeight}`);
    console.log(`Scale Factor: ${scaleFactor}`);
    console.log(`Computed Aspect Ratio: ${computedAspect.toFixed(3)}`);
    console.log(`Measured ProMotion: ${measuredProMotion}`);
    console.log(`WebGL GPU: ${gpuRenderer}`);
    
    // Fetch device specs from YAML
    const deviceData = await fetchDeviceData();
    
    // Set tolerances (these may be adjusted)
    const logicalTol = 10; // tolerance for logical dimensions in pixels
    const physicalTol = 30; // tolerance for physical dimensions
    const scaleTol = 0.2; // tolerance for scale factor
    const aspectTol = 0.05; // tolerance for aspect ratio difference
    
    // Create an array of candidate devices by checking all key properties
    let candidates = [];
    Object.entries(deviceData).forEach(([device, specs]) => {
      // Check logical dimensions
      const logicalWidthMatch = Math.abs(logicalWidth - specs.logical_width) <= logicalTol;
      const logicalHeightMatch = Math.abs(logicalHeight - specs.logical_height) <= logicalTol;
      // Check physical dimensions
      const physicalWidthMatch = Math.abs(physicalWidth - specs.physical_width) <= physicalTol;
      const physicalHeightMatch = Math.abs(physicalHeight - specs.physical_height) <= physicalTol;
      // Check scale factor
      const scaleMatch = Math.abs(scaleFactor - specs.scale_factor) <= scaleTol;
      // Compute YAML aspect ratio from its string (assumed format like "9:21")
      let yamlAspect = null;
      if (typeof specs.aspect_ratio === "string" && specs.aspect_ratio.includes(":")) {
        const parts = specs.aspect_ratio.split(":").map(parseFloat);
        if (parts.length === 2 && parts[1] !== 0) {
          yamlAspect = parts[0] / parts[1];
        }
      }
      const aspectMatch = yamlAspect !== null && Math.abs(computedAspect - yamlAspect) <= aspectTol;
      // Check ProMotion support (YAML field "pro-motion" is boolean)
      const proMotionMatch = measuredProMotion === specs["pro-motion"];
      
      if (logicalWidthMatch && logicalHeightMatch && physicalWidthMatch && physicalHeightMatch &&
          scaleMatch && aspectMatch && proMotionMatch) {
        candidates.push(device);
      }
    });
    
    console.log("Candidates based on all criteria:", candidates);
    
    // If multiple candidates remain, try to refine using GPU info (if GPU is known)
    if (candidates.length > 1 && gpuRenderer.toLowerCase() !== "unknown") {
      const refined = candidates.filter(device => {
        const specs = deviceData[device];
        if (specs.gpu && specs.gpu.toLowerCase() !== "unknown") {
          return gpuRenderer.toLowerCase().includes(specs.gpu.toLowerCase());
        }
        return false;
      });
      if (refined.length > 0) {
        candidates = refined;
      }
    }
    
    // Final detected device: if one candidate, use it; if multiple, join them.
    let detectedDevice = "Unknown Apple Device";
    if (candidates.length === 1) {
      detectedDevice = candidates[0];
    } else if (candidates.length > 1) {
      detectedDevice = candidates.join(" | ");
    }
    
    // Determine Dynamic Island status using the candidate name(s)
    const dynamicIslandStatus = hasDynamicIsland(detectedDevice) ? "Yes" : "No";
    
    // Update UI with detection results
    updateUI(
      detectedDevice,
      `${logicalWidth} x ${logicalHeight} (Scale: ${scaleFactor})`,
      gpuRenderer,
      measuredProMotion ? "Yes (120Hz)" : "No",
      dynamicIslandStatus,
      gpuRenderer
    );
  }
  
  // Run detection on page load.
  document.addEventListener("DOMContentLoaded", function () {
    detectAppleDevice();
  });

  

// Show appropriate form when user selects correct/incorrect
function showForm(isCorrect) {
    document.getElementById("confirmation-box").classList.add("hide");
    document.getElementById("correct-form").style.display = isCorrect ? "block" : "none";
    document.getElementById("incorrect-form").style.display = isCorrect ? "none" : "block";
}

// Go back to confirmation screen
function goBack() {
    document.getElementById("confirmation-box").classList.remove("hide");
    document.getElementById("correct-form").style.display = "none";
    document.getElementById("incorrect-form").style.display = "none";
}

// Submit form data and send to Google Sheets
function submitForm(isCorrect) {
    const name = isCorrect ? document.getElementById("name").value : document.getElementById("incorrect-name").value;
    const correctDevice = isCorrect ? "" : document.getElementById("correct-device").value;

    if (!name.trim() || (!isCorrect && !correctDevice.trim())) {
        alert("Please fill in all fields!");
        return;
    }

    const googleSheetsUrl = "https://script.google.com/macros/s/AKfycbzt7oG5UGnqN9fMSebtm4b1v8l2eZBLjbATV5u5fJLtRHyNNzkR2yddomm-AVPlyRmhYQ/exec";

    fetch(googleSheetsUrl, {
        method: "POST",
        mode: 'no-cors',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: name, isCorrect, correctDevice })
    });

    // Hide all forms and show danke screen
    document.getElementById("correct-form").style.display = "none";
    document.getElementById("incorrect-form").style.display = "none";
    document.getElementById("confirmation-box").style.display = "none";
    document.getElementById("danke-screen").style.display = "block"; // Ensure danke-screen ID is correct
}


