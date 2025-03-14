// Fetch and parse the JSON file containing device specs
async function fetchDeviceData() {
  const response = await fetch("devices.json");
  const jsonData = await response.json();
  return jsonData; // JSON is expected to be an array of device objects
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

// -------------------------
// Weighted Candidate Filtering (Optional Approach)
// -------------------------
/**
 * Computes a weighted difference score for a candidate device.
 * Lower scores indicate a closer match.
 * @param {Object} candidate - Candidate device object.
 * @param {Object} computed - Computed values from the current device.
 * @returns {number} - The difference score.
 */
function weightedCandidateScore(candidate, computed) {
  const tolWidth = 10;      // tolerance for logical width
  const tolHeight = 10;     // tolerance for logical height
  const tolScale = 0.2;     // tolerance for scale factor
  const tolAspect = 0.05;   // tolerance for aspect ratio difference
  const tolDiagonal = 0.5;  // tolerance for screen diagonal in inches
  
  let score = 0;
  score += Math.abs(computed.logicalWidth - Number(candidate.logical_width)) / tolWidth;
  score += Math.abs(computed.logicalHeight - Number(candidate.logical_height)) / tolHeight;
  score += Math.abs(computed.scaleFactor - Number(candidate.scale_factor)) / tolScale;
  
  let candidateAspect = null;
  if (typeof candidate.aspect_ratio === "string" && candidate.aspect_ratio.includes(":")) {
    const parts = candidate.aspect_ratio.split(":").map(parseFloat);
    if (parts.length === 2 && parts[1] !== 0) {
      candidateAspect = parts[0] / parts[1];
    }
  }
  if (candidateAspect !== null) {
    score += Math.abs(computed.computedAspect - candidateAspect) / tolAspect;
  } else {
    score += 5; // penalty if aspect ratio is unavailable
  }
  
  score += Math.abs(computed.computedDiagonalInches - Number(candidate.screen_diagonal)) / tolDiagonal;
  
  if (computed.measuredProMotion !== candidate["pro-motion"]) {
    score += 10; // penalty if ProMotion doesn't match
  }
  
  return score;
}

// -------------------------
// Main Device Detection Function
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
  
  // Prepare computed values for weighted scoring
  const computed = {
    logicalWidth,
    logicalHeight,
    scaleFactor,
    computedAspect,
    computedDiagonalInches,
    measuredProMotion
  };
  
  // Fetch device specs from devices.json (which is an array)
  const deviceData = await fetchDeviceData(); // deviceData is an array
  
  // Stage 1: Filter candidates based solely on screen diagonal (in inches)
  let candidates1 = deviceData.filter(candidate => {
    return Math.abs(computedDiagonalInches - Number(candidate.screen_diagonal)) <= 0.5;
  }).map(candidate => candidate.device);
  
  // Stage 2: From deviceData, filter by logical dimensions, scale factor, and aspect ratio
  let candidates2 = deviceData.filter(candidate => {
    const lwMatch = Math.abs(logicalWidth - Number(candidate.logical_width)) <= 10;
    const lhMatch = Math.abs(logicalHeight - Number(candidate.logical_height)) <= 10;
    const scaleMatch = Math.abs(scaleFactor - Number(candidate.scale_factor)) <= 0.2;
    
    let candidateAspect = null;
    if (typeof candidate.aspect_ratio === "string" && candidate.aspect_ratio.includes(":")) {
      const parts = candidate.aspect_ratio.split(":").map(parseFloat);
      if (parts.length === 2 && parts[1] !== 0) {
        candidateAspect = parts[0] / parts[1];
      }
    }
    const aspectMatch = candidateAspect !== null && Math.abs(computedAspect - candidateAspect) <= 0.05;
    
    return lwMatch && lhMatch && scaleMatch && aspectMatch;
  }).map(candidate => candidate.device);
  
  // Optionally, refine candidates2 further using GPU info if available
  let candidateScores = [];
  deviceData.forEach(candidate => {
    if (candidates2.includes(candidate.device)) {
      const score = weightedCandidateScore(candidate, computed);
      candidateScores.push({ device: candidate.device, score });
    }
  });
  candidateScores.sort((a, b) => a.score - b.score);
  
  // Use a threshold to choose candidates within 1 score of the best match
  const bestScore = candidateScores[0] ? candidateScores[0].score : Infinity;
  const threshold = bestScore + 1;
  let refinedCandidates = candidateScores.filter(c => c.score <= threshold).map(c => c.device);
  
  // Final detected device based on refined candidates
  let detectedDevice = "Unknown Apple Device";
  if (refinedCandidates.length === 1) {
    detectedDevice = refinedCandidates[0];
  } else if (refinedCandidates.length > 1) {
    detectedDevice = refinedCandidates.join(" | ");
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
    refinedCandidates
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