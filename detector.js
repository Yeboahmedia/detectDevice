// Fetch and parse the YAML file containing device specs
async function fetchDeviceData() {
    const response = await fetch("devices.yaml");
    const yamlText = await response.text();
    return parseYAML(yamlText);
  }
  
  // A simple YAML parser tailored for our devices.yaml structure.
  function parseYAML(yamlText) {
    const lines = yamlText.split("\n").filter(line => line.trim() && !line.trim().startsWith("#"));
    const devices = {};
    let currentDevice = null;
    for (const line of lines) {
      // Check for device header (ends with a colon, no indent)
      if (/^[^ \t].*:\s*$/.test(line)) {
        currentDevice = line.split(":")[0].trim();
        devices[currentDevice] = {};
      } else if (currentDevice) {
        // Expect lines like "key: value" (may be indented)
        const [key, ...rest] = line.trim().split(":");
        if (key && rest.length) {
          devices[currentDevice][key.trim()] = rest.join(":").trim();
        }
      }
    }
    return devices;
  }
  
  // Get the WebGL GPU information if available.
  function getGPUInfo() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return "Unknown GPU";
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Apple GPU";
  }
  
  // Check for ProMotion (120Hz) support using a heuristic.
  function hasProMotion() {
    // Note: This is not a definitive test for ProMotion, but can serve as a hint.
    return window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  }
  
  // The main detection logic.
  async function detectAppleDevice() {
    // Check if the user agent indicates an Apple mobile device.
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad/.test(ua);
    if (!isIOS) {
      updateUI("Not an iPhone or iPad", "N/A", "N/A", "N/A");
      return;
    }
    
    // Compute the physical resolution
    const dpr = window.devicePixelRatio || 1;
    const physWidth = window.screen.width * dpr;
    const physHeight = window.screen.height * dpr;
    
    // Fetch device specifications from YAML.
    const deviceData = await fetchDeviceData();
    
    // Build a list of candidate devices matching physical resolution (allowing for orientation).
    let candidates = [];
    Object.entries(deviceData).forEach(([device, specs]) => {
      if (!specs.resolution) return;
      const [specWidth, specHeight] = specs.resolution.split("x").map(Number);
      // Check if resolution matches in either orientation.
      if (
        (physWidth === specWidth && physHeight === specHeight) ||
        (physWidth === specHeight && physHeight === specWidth)
      ) {
        candidates.push({ device, specs });
      }
    });
    
    // If multiple candidates match (or none), we try to narrow using GPU info.
    let selectedDevice = candidates.length === 1 ? candidates[0] : null;
    const gpuRenderer = getGPUInfo();
    
    if (candidates.length > 1) {
      // Narrow down candidates that have a GPU spec substring that matches GPU info from WebGL.
      const filtered = candidates.filter(candidate => {
        const candidateGPU = candidate.specs.gpu || "";
        return gpuRenderer.indexOf(candidateGPU.split(" ")[0]) !== -1;
      });
      if (filtered.length > 0) {
        selectedDevice = filtered[0];
      } else {
        // Fallback: choose the first candidate.
        selectedDevice = candidates[0];
      }
    }
    
    // If no candidates match based on resolution, fallback to "Unknown"
    if (!selectedDevice) {
      updateUI("Unknown Apple Device", `${physWidth} x ${physHeight}`, gpuRenderer, hasProMotion() ? "Yes (120Hz)" : "No");
      return;
    }
    
    // Determine the GPU info: if WebGL returned "Apple GPU", use YAML data as fallback.
    let detectedGPU = gpuRenderer === "Apple GPU" ? selectedDevice.specs.gpu : gpuRenderer;
    
    // Confirm ProMotion based on YAML flag and our matchMedia heuristic.
    const candidatePromotion = (selectedDevice.specs.promotion || "").toLowerCase() === "true";
    const promotionStatus = candidatePromotion && hasProMotion() ? "Yes (120Hz)" : "No";
    
    updateUI(
      selectedDevice.device,
      `${physWidth} x ${physHeight}`,
      detectedGPU,
      promotionStatus
    );
  }
  
  // Update the UI elements on the page.
  function updateUI(deviceName, resolution, gpu, promotion) {
    document.getElementById("device-name").innerText = deviceName;
    document.getElementById("screen-size").innerText = resolution;
    document.getElementById("gpu-info").innerText = gpu;
    document.getElementById("promotion").innerText = promotion;
  }
  
  // Run detection on page load.
  detectAppleDevice();
  