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
    return window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
}

// Determine if the device has a Dynamic Island (for Pro models).
function hasDynamicIsland(deviceName) {
    const lowerName = deviceName.toLowerCase();
    return lowerName.includes("14 pro") || lowerName.includes("15 pro") || lowerName.includes("16 pro");
}

// Update the UI elements on the page.
function updateUI(deviceName, resolution, gpu, promotion, dynamicIsland, webglGPU) {
    document.getElementById("device-name").innerText = deviceName;
    document.getElementById("screen-size").innerText = resolution;
    document.getElementById("gpu-info").innerText = gpu;
    document.getElementById("promotion").innerText = promotion;
    document.getElementById("dynamic-island").innerText = dynamicIsland;
    document.getElementById("webgl-gpu").innerText = webglGPU; // Show WebGL GPU result
}


// The main detection logic.
async function detectAppleDevice() {
    const dpr = window.devicePixelRatio || 1;
    const physWidth = Math.round(window.screen.width * dpr);
    const physHeight = Math.round(window.screen.height * dpr);
    const gpuRenderer = getGPUInfo(); // Get WebGL GPU Renderer

    console.log(`Detected resolution: ${physWidth} x ${physHeight}`);
    console.log(`WebGL GPU Renderer: ${gpuRenderer}`);

    // Fetch device specifications from YAML.
    const deviceData = await fetchDeviceData();

    // Step 1: Find devices that match resolution (allow portrait & landscape).
    let candidates = [];
    Object.entries(deviceData).forEach(([device, specs]) => {
        if (!specs.resolution) return;
        const [specWidth, specHeight] = specs.resolution.split("x").map(Number);

        if (
            (physWidth === specWidth && physHeight === specHeight) ||
            (physWidth === specHeight && physHeight === specWidth)
        ) {
            candidates.push({ device, specs });
        }
    });

    console.log("Resolution-matched candidates:", candidates);

    // Step 2: Ensure we're actually on an iPhone/iPad.
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad/.test(ua);

    if (!isIOS || candidates.length === 0) {
        console.warn("Device is either not an iPhone or no resolution match was found.");
        updateUI(
            "Not an iPhone or iPad",
            `${physWidth} x ${physHeight}`,
            gpuRenderer,
            "N/A",
            "N/A",
            "N/A"
        );
        return;
    }

    // Step 3: If exactly one match, use it.
    let selectedDevice = candidates.length === 1 ? candidates[0] : null;

    // Step 4: If multiple candidates exist, refine using GPU.
    if (candidates.length > 1) {
        console.log("Multiple candidates found. Attempting to filter by GPU...");
        const filtered = candidates.filter(candidate => {
            return candidate.specs.gpu && gpuRenderer.includes(candidate.specs.gpu);
        });

        if (filtered.length > 0) {
            selectedDevice = filtered[0]; // Exact GPU match
        } else {
            console.warn("No exact GPU match found. Falling back to closest resolution match.");
            selectedDevice = candidates[0]; // Use first resolution match
        }
    }

    // Step 5: Handle the case where no device is found.
    if (!selectedDevice) {
        console.error("No valid device was identified.");
        updateUI(
            "Unknown Apple Device",
            `${physWidth} x ${physHeight}`,
            gpuRenderer,
            hasProMotion() ? "Yes (120Hz)" : "No",
            "No",
            gpuRenderer // Show actual WebGL result
        );
        return;
    }

    // Step 6: Use WebGL GPU if not masked, otherwise fallback to YAML
    let finalGPU = gpuRenderer === "Apple GPU" ? selectedDevice.specs.gpu : gpuRenderer;

    // Step 7: Determine ProMotion
    const fromYaml = (selectedDevice.specs.promotion || "").toLowerCase() === "true";
    const finalPromotion = fromYaml && hasProMotion() ? "Yes (120Hz)" : "No";

    // Step 8: Determine Dynamic Island
    const finalDynamicIsland = hasDynamicIsland(selectedDevice.device) ? "Yes" : "No";

    // Step 9: Update UI
    updateUI(
        selectedDevice.device,
        `${physWidth} x ${physHeight}`,
        finalGPU,
        finalPromotion,
        finalDynamicIsland,
        gpuRenderer // Add actual WebGL GPU result to UI
    );
}

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

// Run detection on page load.
document.addEventListener("DOMContentLoaded", function () {
    detectAppleDevice();
});
