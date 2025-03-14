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
        currentDevice = line.split(":")[0].trim();
        devices[currentDevice] = {};
      } else if (currentDevice) {
        const [key, ...valueParts] = line.trim().split(":");
        let value = valueParts.join(":").trim();
        if (key.trim().toLowerCase() === "aspect_ratio") {
          value = value.replace(/^(Aspect Ratio:)/i, "").trim();
        }
        if (key.trim().toLowerCase() === "release_date") {
          value = value.replace(/^(Release Date:)/i, "").trim();
        }
        if (!isNaN(value)) {
          value = parseFloat(value);
        }
        if (typeof value === "string") {
          const lowerVal = value.toLowerCase();
          if (lowerVal === "true" || lowerVal === "false") {
            value = lowerVal === "true";
          }
        }
        devices[currentDevice][key.trim()] = value;
      }
    }
    return devices;
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
  
  // Get an assumed PPI based on the user agent
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
  
  // Determine if the device name suggests a Dynamic Island (for Pro models)
  function hasDynamicIsland(deviceName) {
    const lowerName = deviceName.toLowerCase();
    return lowerName.includes("14 pro") || lowerName.includes("15 pro") || lowerName.includes("16 pro");
  }
  
  // Update UI elements on the page.
  function updateUI(deviceName, resolution, diagonal, promotion, dynamicIsland) {
    document.getElementById("device-name").innerText = deviceName;
    document.getElementById("screen-size").innerText = resolution;
    document.getElementById("screen-diagonal").innerText = diagonal.toFixed(2) + " inches";
    document.getElementById("promotion").innerText = promotion;
    document.getElementById("dynamic-island").innerText = dynamicIsland;
  }
  
  // Main device detection function combining all factors
  async function detectAppleDevice() {
    const logicalWidth = window.screen.width;
    const logicalHeight = window.screen.height;
    const scaleFactor = window.devicePixelRatio || 1;
    
    const physicalWidth = Math.round(logicalWidth * scaleFactor);
    const physicalHeight = Math.round(logicalHeight * scaleFactor);
    
    const computedAspect = computeAspectRatio(physicalWidth, physicalHeight);
    
    const assumedPPI = getAssumedPPI();
    const computedDiagonal = computeScreenDiagonal(physicalWidth, physicalHeight, assumedPPI);
    
    let measuredProMotion = await detectProMotion();
    const ua = navigator.userAgent;
    const isIOS = ua.includes("iPhone") || ua.includes("iPad");
    if (isIOS && !measuredProMotion) {
      // Heuristically override ProMotion if the YAML expects it (you may adjust this behavior)
      measuredProMotion = false;
    }
    
    const gpuRenderer = getGPUInfo();
    
    const deviceData = await fetchDeviceData();
    
    const logicalTol = 10;
    const scaleTol = 0.2;
    const aspectTol = 0.05;
    const diagonalTol = 0.5;
    
    let candidates = [];
    Object.entries(deviceData).forEach(([device, specs]) => {
      const logicalWidthMatch = Math.abs(logicalWidth - specs.logical_width) <= logicalTol;
      const logicalHeightMatch = Math.abs(logicalHeight - specs.logical_height) <= logicalTol;
      const scaleMatch = Math.abs(scaleFactor - specs.scale_factor) <= scaleTol;
      
      let yamlAspect = null;
      if (typeof specs.aspect_ratio === "string" && specs.aspect_ratio.includes(":")) {
        const parts = specs.aspect_ratio.split(":").map(parseFloat);
        if (parts.length === 2 && parts[1] !== 0) {
          yamlAspect = parts[0] / parts[1];
        }
      }
      const aspectMatch = yamlAspect !== null && Math.abs(computedAspect - yamlAspect) <= aspectTol;
      const proMotionMatch = measuredProMotion === specs["pro-motion"];
      const diagonalMatch = Math.abs(computedDiagonal - specs.screen_diagonal) <= diagonalTol;
      
      if (logicalWidthMatch && logicalHeightMatch && scaleMatch && aspectMatch && proMotionMatch && diagonalMatch) {
        candidates.push(device);
      }
    });
    
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
    
    const dynamicIslandStatus = hasDynamicIsland(detectedDevice) ? "Yes" : "No";
    
    updateUI(
      detectedDevice,
      `${logicalWidth} x ${logicalHeight} (Scale: ${scaleFactor})`,
      computedDiagonal,
      measuredProMotion ? "Yes (120Hz)" : "No",
      dynamicIslandStatus
    );
  }
  
  document.addEventListener("DOMContentLoaded", function () {
    detectAppleDevice();
  });
  
  // Form and submission logic remain unchanged
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
  