// Fetch and parse the YAML file containing device specs
async function fetchDeviceData() {
    const response = await fetch("ios_devices.yaml");
    const yamlText = await response.text();
    return parseYAML(yamlText);
  }
  
  // YAML Parser for structured device data
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
        if (!isNaN(value)) value = parseFloat(value);
        if (value === "true" || value === "false") value = (value === "true");
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
  
  // Measure the actual frame rate over a specified duration (in ms)
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
    // For a 120Hz device, measured fps will be closer to 120; use 100Hz as threshold
    return fps > 100;
  }
  
  // Determine if the device has a Dynamic Island (for Pro models)
  function hasDynamicIsland(deviceName) {
    const lowerName = deviceName.toLowerCase();
    return lowerName.includes("14 pro") || lowerName.includes("15 pro") || lowerName.includes("16 pro");
  }
  
  // Compute aspect ratio from two dimensions
  function computeAspectRatio(width, height) {
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }
  
  // Update the UI elements on the page.
  function updateUI(deviceName, resolution, gpu, promotion, dynamicIsland, webglRenderer) {
    document.getElementById("device-name").innerText = deviceName;
    document.getElementById("screen-size").innerText = resolution;
    document.getElementById("gpu-info").innerText = gpu;
    document.getElementById("promotion").innerText = promotion;
    document.getElementById("dynamic-island").innerText = dynamicIsland;
    // Optionally, display the raw WebGL GPU string for debugging
    document.getElementById("webgl-renderer").innerText = webglRenderer;
  }
  
  // Main detection logic using all variables
  async function detectAppleDevice() {
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = window.screen.width;
    const logicalHeight = window.screen.height;
    const physicalWidth = Math.round(logicalWidth * dpr);
    const physicalHeight = Math.round(logicalHeight * dpr);
  
    // Use measured frame rate for a more accurate ProMotion check
    const measuredFPS = await measureFrameRate(1000);
    const promotionSupport = measuredFPS > 100; // true if near 120Hz
    // Use devicePixelRatio as the scale factor
    const scaleFactor = dpr;
    // Rough estimate for PPI; this can be refined with actual device data if needed
    const ppi = Math.round((physicalWidth / logicalWidth) * 163);
    const aspectRatio = computeAspectRatio(physicalWidth, physicalHeight);
    const gpuRenderer = getGPUInfo();
  
    console.log(`Logical: ${logicalWidth}x${logicalHeight}`);
    console.log(`Physical: ${physicalWidth}x${physicalHeight}`);
    console.log(`DPR (scale factor): ${scaleFactor}`);
    console.log(`Estimated PPI: ${ppi}`);
    console.log(`Aspect Ratio: ${aspectRatio}`);
    console.log(`Measured FPS: ${measuredFPS.toFixed(2)}`);
    console.log(`WebGL GPU: ${gpuRenderer}`);
  
    // Fetch device specs from YAML
    const deviceData = await fetchDeviceData();
  
    // Filter candidate devices by comparing multiple variables:
    // physical dimensions, PPI, aspect ratio, scale factor, and ProMotion support.
    let candidates = [];
    Object.entries(deviceData).forEach(([device, specs]) => {
      const widthMatch = Math.abs(physicalWidth - specs.physical_width) <= 20;
      const heightMatch = Math.abs(physicalHeight - specs.physical_height) <= 20;
      const ppiMatch = Math.abs(ppi - specs.ppi) <= 10;
      const aspectMatch = aspectRatio === specs.aspect_ratio;
      const scaleMatch = Math.abs(scaleFactor - specs.scale_factor) <= 0.2;
      const proMotionMatch = promotionSupport === specs["pro-motion"];
  
      if (widthMatch && heightMatch && ppiMatch && aspectMatch && scaleMatch && proMotionMatch) {
        candidates.push(device);
      }
    });
  
    console.log("Candidates based on multi-variable matching:", candidates);
  
    // If multiple candidates exist, try refining using GPU info
    if (candidates.length > 1) {
      const refined = candidates.filter(device => {
        const specs = deviceData[device];
        return specs.gpu && (gpuRenderer === specs.gpu || gpuRenderer.includes(specs.gpu));
      });
      if (refined.length > 0) {
        candidates = refined;
      }
    }
  
    // Determine the final detected device
    let detectedDevice = "Unknown Apple Device";
    if (candidates.length === 1) {
      detectedDevice = candidates[0];
    } else if (candidates.length > 1) {
      detectedDevice = candidates.join(" | ");
    }
  
    // Determine Dynamic Island status based on the detected device name
    const dynamicIslandStatus = hasDynamicIsland(detectedDevice) ? "Yes" : "No";
  
    // Update the UI with all the gathered information.
    updateUI(
      detectedDevice,
      `${logicalWidth} x ${logicalHeight} (Scale: ${scaleFactor})`,
      gpuRenderer,
      promotionSupport ? "Yes (120Hz)" : "No",
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


