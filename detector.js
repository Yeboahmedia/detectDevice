// Fetch and parse the JSON file containing device specs
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

// Extract WebGL GPU information (optional, for refinement)
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

// -------------------------
// Weighted Candidate Filtering
// -------------------------

/**
 * Compute a weighted score for a candidate device.
 * Lower scores indicate a closer match.
 * @param {Object} candidate - Device spec object from JSON.
 * @param {Object} computed - Computed values from the current device.
 * @returns {number} - The computed score.
 */
function weightedCandidateScore(candidate, computed) {
  // Define tolerances for normalization (these values can be tuned)
  const tolWidth = 10;      // logical width tolerance (points)
  const tolHeight = 10;     // logical height tolerance (points)
  const tolScale = 0.2;     // scale factor tolerance
  const tolAspect = 0.05;   // aspect ratio tolerance (decimal)
  const tolDiagonal = 0.5;  // screen diagonal tolerance (inches)
  let score = 0;
  
  // Logical dimensions difference (normalized by tolerance)
  score += Math.abs(computed.logicalWidth - candidate.logical_width) / tolWidth;
  score += Math.abs(computed.logicalHeight - candidate.logical_height) / tolHeight;
  
  // Scale factor difference
  score += Math.abs(computed.scaleFactor - candidate.scale_factor) / tolScale;
  
  // Aspect ratio difference: parse candidate's aspect_ratio from "W:H"
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
    score += 5; // penalty if candidate aspect ratio cannot be determined
  }
  
  // Screen diagonal difference
  score += Math.abs(computed.computedDiagonalInches - candidate.screen_diagonal) / tolDiagonal;
  
  // ProMotion: if measured doesn't match candidate's "pro-motion", add a penalty.
  if (computed.measuredProMotion !== candidate["pro-motion"]) {
    score += 10;
  }
  
  return score;
}

// -------------------------
// Update UI
// -------------------------
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
// Main Detection Function
// -------------------------
async function detectAppleDevice() {
  // Get logical dimensions (points) and scale factor
  const logicalWidth = window.screen.width;
  const logicalHeight = window.screen.height;
  const scaleFactor = window.devicePixelRatio || 1;
  
  // Compute physical dimensions (pixels)
  const physicalWidth = Math.round(logicalWidth * scaleFactor);
  const physicalHeight = Math.round(logicalHeight * scaleFactor);
  
  // Compute aspect ratio from physical dimensions
  const computedAspect = computeAspectRatio(physicalWidth, physicalHeight);
  
  // Get assumed PPI and compute screen diagonal (in inches and mm)
  const assumedPPI = getAssumedPPI();
  const computedDiagonalInches = computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI);
  const computedDiagonalMM = computedDiagonalInches * 25.4;
  
  // Get measured ProMotion support
  let measuredProMotion = await detectProMotion();
  const ua = navigator.userAgent;
  const isIOS = ua.includes("iPhone") || ua.includes("iPad");
  // (Optional: override measuredProMotion if needed)
  
  // Get GPU info
  const gpuRenderer = getGPUInfo();
  
  // Create an object with computed values for weighted scoring
  const computed = {
    logicalWidth,
    logicalHeight,
    scaleFactor,
    computedAspect,
    computedDiagonalInches,
    measuredProMotion
  };
  
  // Fetch device specs from devices.json
  const deviceData = await fetchDeviceData();
  
  // Stage 1: Filter candidates by screen diagonal only
  let candidates1 = [];
  Object.entries(deviceData).forEach(([device, specs]) => {
    if (Math.abs(computedDiagonalInches - Number(specs.screen_diagonal)) <= 0.5) {
      candidates1.push(device);
    }
  });
  
  // Stage 2: Compute weighted scores for each candidate in deviceData
  let candidateScores = [];
  for (const device in deviceData) {
    const score = weightedCandidateScore(deviceData[device], computed);
    candidateScores.push({ device, score });
  }
  // Sort candidates by score (lowest score is best match)
  candidateScores.sort((a, b) => a.score - b.score);
  
  // For UI, candidates2 will be the ones from weighted scoring with a threshold near the best score.
  const bestScore = candidateScores[0] ? candidateScores[0].score : Infinity;
  const threshold = bestScore + 1; // allow all candidates within 1 score of best
  let candidates2 = candidateScores.filter(c => c.score <= threshold).map(c => c.device);
  
  // Final detected device: if one candidate in candidates2, use it; if multiple, join them.
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

// -------------------------
// Form and Submission Logic
// -------------------------
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

/**
 * Compute a weighted score for a candidate device.
 * Lower scores indicate a closer match.
 * @param {Object} candidate - Candidate device specs from JSON.
 * @param {Object} computed - Computed values from the current device.
 * @returns {number} - The weighted difference score.
 */
function weightedCandidateScore(candidate, computed) {
  const tolWidth = 10;      // logical width tolerance (points)
  const tolHeight = 10;     // logical height tolerance (points)
  const tolScale = 0.2;     // scale factor tolerance
  const tolAspect = 0.05;   // aspect ratio tolerance (decimal)
  const tolDiagonal = 0.5;  // diagonal tolerance (inches)
  
  let score = 0;
  // Logical dimensions differences
  score += Math.abs(computed.logicalWidth - Number(candidate.logical_width)) / tolWidth;
  score += Math.abs(computed.logicalHeight - Number(candidate.logical_height)) / tolHeight;
  // Scale factor difference
  score += Math.abs(computed.scaleFactor - Number(candidate.scale_factor)) / tolScale;
  
  // Aspect ratio difference: parse candidate aspect ratio (format "W:H")
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
    score += 5; // add penalty if candidate aspect ratio is unavailable
  }
  
  // Screen diagonal difference
  score += Math.abs(computed.computedDiagonalInches - Number(candidate.screen_diagonal)) / tolDiagonal;
  
  // ProMotion penalty if mismatch (add a large penalty)
  if (computed.measuredProMotion !== candidate["pro-motion"]) {
    score += 10;
  }
  
  return score;
}
