// Fetch and parse the JSON file containing device specs (converted from YAML)
async function fetchDeviceData() {
  const response = await fetch("devices.json");
  const jsonText = await response.text();
  return JSON.parse(jsonText);
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

// Compute aspect ratio as a decimal from width and height
function computeAspectRatio(width, height) {
  return width / height;
}

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

// Extract WebGL GPU information
function getGPUInfo() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) return "Unknown GPU";
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Apple GPU";
}

// Determine if the device name suggests a Dynamic Island (for Pro models)
function hasDynamicIsland(deviceName) {
  const lowerName = deviceName.toLowerCase();
  return lowerName.includes("14 pro") || lowerName.includes("15 pro") || lowerName.includes("16 pro");
}

// Update UI elements on the page, including candidate lists and both diagonal values
function updateUI(deviceName, resolution, diagonalInches, diagonalMM, gpu, promotion, dynamicIsland, candidates1, candidates2) {
  document.getElementById("device-name").innerText = deviceName;
  document.getElementById("screen-size").innerText = resolution;
  document.getElementById("screen-diagonal").innerText = diagonalInches.toFixed(2) + " inches";
  document.getElementById("screen-diagonal-mm").innerText = diagonalMM.toFixed(2) + " mm";
  document.getElementById("gpu-info").innerText = gpu;
  document.getElementById("promotion").innerText = promotion;
  document.getElementById("dynamic-island").innerText = dynamicIsland;
  document.getElementById("candidates_1").innerText = candidates1.length ? candidates1.join(" | ") : "None";
  document.getElementById("candidates_2").innerText = candidates2.length ? candidates2.join(" | ") : "None";
}

// Main device detection function combining all factors in two stages
async function detectAppleDevice() {
  // Get logical dimensions (in points) and scale factor
  const logicalWidth = window.screen.width;
  const logicalHeight = window.screen.height;
  const scaleFactor = window.devicePixelRatio || 1;
  
  // Compute physical dimensions (in pixels)
  const physicalWidth = Math.round(logicalWidth * scaleFactor);
  const physicalHeight = Math.round(logicalHeight * scaleFactor);
  
  // Compute aspect ratio from physical dimensions
  const computedAspect = computeAspectRatio(physicalWidth, physicalHeight);
  
  // Compute screen diagonal (in inches) using an assumed PPI
  const assumedPPI = getAssumedPPI();
  const computedDiagonalInches = computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI);
  const computedDiagonalMM = computedDiagonalInches * 25.4; // Convert inches to millimeters
  
  // Get measured ProMotion support
  let measuredProMotion = await detectProMotion();
  const ua = navigator.userAgent;
  const isIOS = ua.includes("iPhone") || ua.includes("iPad");
  // Optionally override measuredProMotion if needed on iOS
  if (isIOS && !measuredProMotion) {
    // For now, we'll keep the measured value
  }
  
  // Get GPU info for refinement
  const gpuRenderer = getGPUInfo();
  
  // Fetch device specs from devices.json (converted from YAML)
  const deviceData = await fetchDeviceData();
  
  // Set tolerances for matching
  const logicalTol = 10;       // tolerance for logical dimensions (points)
  const scaleTol = 0.2;        // tolerance for scale factor
  const aspectTol = 0.05;      // tolerance for aspect ratio difference (decimal)
  const diagonalTol = 0.5;     // tolerance for screen diagonal (inches)
  
  // Stage 1: Filter candidates based solely on screen diagonal matching
  let candidates1 = [];
  Object.entries(deviceData).forEach(([device, specs]) => {
    const diagMatch = Math.abs(computedDiagonalInches - Number(specs.screen_diagonal)) <= diagonalTol;
    if (diagMatch) {
      candidates1.push(device);
    }
  });
  
  // Stage 2: From candidates1, further filter using logical dimensions, scale factor, and aspect ratio
  let candidates2 = [];
  candidates1.forEach(device => {
    const specs = deviceData[device];
    const lwMatch = Math.abs(logicalWidth - Number(specs.logical_width)) <= logicalTol;
    const lhMatch = Math.abs(logicalHeight - Number(specs.logical_height)) <= logicalTol;
    const scaleMatch = Math.abs(scaleFactor - Number(specs.scale_factor)) <= scaleTol;
    
    let yamlAspect = null;
    if (typeof specs.aspect_ratio === "string" && specs.aspect_ratio.includes(":")) {
      const parts = specs.aspect_ratio.split(":").map(parseFloat);
      if (parts.length === 2 && parts[1] !== 0) {
        yamlAspect = parts[0] / parts[1];
      }
    }
    const aspectMatch = yamlAspect !== null && Math.abs(computedAspect - yamlAspect) <= aspectTol;
    
    if (lwMatch && lhMatch && scaleMatch && aspectMatch) {
      candidates2.push(device);
    }
  });
  
  // Optional: refine candidates2 further using GPU info if available
  if (candidates2.length > 1 && gpuRenderer.toLowerCase() !== "unknown") {
    const refined = candidates2.filter(device => {
      const specs = deviceData[device];
      if (specs.gpu && specs.gpu.toLowerCase() !== "unknown") {
        return gpuRenderer.toLowerCase().includes(specs.gpu.toLowerCase());
      }
      return false;
    });
    if (refined.length > 0) {
      candidates2 = refined;
    }
  }
  
  let detectedDevice = "Unknown Apple Device";
  if (candidates2.length === 1) {
    detectedDevice = candidates2[0];
  } else if (candidates2.length > 1) {
    detectedDevice = candidates2.join(" | ");
  }
  
  const dynamicIslandStatus = hasDynamicIsland(detectedDevice) ? "Yes" : "No";
  const resolutionStr = `${logicalWidth} x ${logicalHeight} (Scale: ${scaleFactor})`;
  const promotionStr = measuredProMotion ? "Yes (120Hz)" : "No";
  
  updateUI(
    detectedDevice,
    resolutionStr,
    computedDiagonalInches,
    computedDiagonalMM,
    gpuRenderer,
    promotionStr,
    dynamicIslandStatus,
    candidates1,
    candidates2
  );
}

document.addEventListener("DOMContentLoaded", function () {
  detectAppleDevice();
});

// --- Form and Submission Logic --- //

function showForm(isCorrect) {
  document.getElementById("confirmation-box").classList.add("hide");
  document.getElementById("correct-form").style.display = isCorrect ? "block" : "none";
  document.getElementById("incorrect-form").style.display = isCorrect ? "none" : "block";
}

function goBack() {
  document.getElementById("confirmation-box").classList.remove("hide");
  document.getElementById("correct-form").style.display = "none";
  document.getElementById("incorrect-form").style.display = "none";
}

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
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: name, isCorrect, correctDevice })
  });
  
  document.getElementById("correct-form").style.display = "none";
  document.getElementById("incorrect-form").style.display = "none";
  document.getElementById("confirmation-box").style.display = "none";
  document.getElementById("danke-screen").style.display = "block";
}
