// Fetch and parse the YAML file containing device specs
async function fetchDeviceData() {
    const response = await fetch("ios_devices.yaml");
    const yamlText = await response.text();
    return parseYAML(yamlText);
  }
  
  // YAML Parser for structured device data with normalization
  function parseYAML(yamlText) {
    const lines = yamlText.split("\n").filter(line => line.trim() && !line.trim().startsWith("#"));
    let devices = {};
    let currentDevice = null;
  
    for (const line of lines) {
      if (/^[^\s].*:$/.test(line)) {
        currentDevice = line.split(":")[0].trim();
        devices[currentDevice] = {};
      } else if (currentDevice) {
        const [key, ...valueParts] = line.trim().split(":");
        let value = valueParts.join(":").trim();
  
        // Normalize known keys by stripping prefixes (if any)
        if (key.trim().toLowerCase() === "aspect_ratio") {
          value = value.replace(/^(Aspect Ratio:)/i, "").trim();
        }
        if (key.trim().toLowerCase() === "release_date") {
          value = value.replace(/^(Release Date:)/i, "").trim();
        }
        // Convert numeric values if possible
        if (!isNaN(value)) {
          value = parseFloat(value);
        }
        // Convert boolean strings
        if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
          value = value.toLowerCase() === "true";
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
  
  // Measure actual frame rate over a specified duration (in ms)
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
  
  // Alternative ProMotion check using measured frame rate
  async function detectProMotion() {
    const fps = await measureFrameRate(1000);
    return fps > 100; // True if measured fps is above ~100 (indicative of 120Hz)
  }
  
  // Determine if the device has a Dynamic Island (for Pro models)
  function hasDynamicIsland(deviceName) {
    const lowerName = deviceName.toLowerCase();
    return lowerName.includes("14 pro") || lowerName.includes("15 pro") || lowerName.includes("16 pro");
  }
  
  // Compute aspect ratio as a decimal
  function computeAspectRatio(width, height) {
    return width / height;
  }
  
  // Update the UI elements on the page.
  function updateUI(deviceName, resolution, gpu, promotion, dynamicIsland, webglRenderer) {
    document.getElementById("device-name").innerText = deviceName;
    document.getElementById("screen-size").innerText = resolution;
    document.getElementById("gpu-info").innerText = gpu;
    document.getElementById("promotion").innerText = promotion;
    document.getElementById("dynamic-island").innerText = dynamicIsland;
    document.getElementById("webgl-renderer").innerText = webglRenderer;
  }
  
  // Main detection logic using all available variables
  async function detectAppleDevice() {
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = window.screen.width;
    const logicalHeight = window.screen.height;
    const physicalWidth = Math.round(logicalWidth * dpr);
    const physicalHeight = Math.round(logicalHeight * dpr);
    const scaleFactor = dpr;
    const computedAspect = computeAspectRatio(physicalWidth, physicalHeight);
    const gpuRenderer = getGPUInfo();
    const measuredProMotion = await detectProMotion();
  
    console.log(`Logical: ${logicalWidth} x ${logicalHeight}`);
    console.log(`Physical: ${physicalWidth} x ${physicalHeight}`);
    console.log(`Scale Factor: ${scaleFactor}`);
    console.log(`Computed Aspect Ratio: ${computedAspect.toFixed(3)}`);
    console.log(`Measured FPS (ProMotion): ${measuredProMotion ? "High" : "Low"}`);
    console.log(`WebGL GPU: ${gpuRenderer}`);
  
    // Fetch device specs from YAML
    const deviceData = await fetchDeviceData();
  
    let candidates = [];
    // Use tolerances for physical dimensions (±30), scale factor (±0.2), and compare aspect ratio as decimals
    Object.entries(deviceData).forEach(([device, specs]) => {
      const widthMatch = Math.abs(physicalWidth - specs.physical_width) <= 30;
      const heightMatch = Math.abs(physicalHeight - specs.physical_height) <= 30;
      const scaleMatch = Math.abs(scaleFactor - specs.scale_factor) <= 0.2;
  
      // Parse YAML aspect ratio (assumed format "9:19.5" or similar)
      let yamlAspect = null;
      if (typeof specs.aspect_ratio === "string" && specs.aspect_ratio.includes(":")) {
        const parts = specs.aspect_ratio.split(":").map(parseFloat);
        if (parts.length === 2 && parts[1] !== 0) {
          yamlAspect = parts[0] / parts[1];
        }
      }
      const aspectMatch = yamlAspect !== null && Math.abs(computedAspect - yamlAspect) < 0.05;
      const proMotionMatch = measuredProMotion === specs["pro-motion"];
  
      if (widthMatch && heightMatch && scaleMatch && aspectMatch && proMotionMatch) {
        candidates.push(device);
      }
    });
  
    console.log("Candidates based on matching criteria:", candidates);
  
    // If multiple candidates remain, refine using GPU if available (if GPU is not "unknown")
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
  
    let detectedDevice = "Unknown Apple Device";
    if (candidates.length === 1) {
      detectedDevice = candidates[0];
    } else if (candidates.length > 1) {
      detectedDevice = candidates.join(" | ");
    }
  
    // Determine Dynamic Island status
    const dynamicIslandStatus = hasDynamicIsland(detectedDevice) ? "Yes" : "No";
  
    // Update UI with results
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


