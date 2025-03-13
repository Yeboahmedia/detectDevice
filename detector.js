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
function updateUI(deviceName, resolution, gpu, promotion, dynamicIsland) {
    document.getElementById("device-name").innerText = deviceName;
    document.getElementById("screen-size").innerText = resolution;
    document.getElementById("gpu-info").innerText = gpu;
    document.getElementById("promotion").innerText = promotion;
    document.getElementById("dynamic-island").innerText = dynamicIsland;
}

// The main detection logic.
async function detectAppleDevice() {
    const dpr = window.devicePixelRatio || 1;
    const physWidth = Math.round(window.screen.width * dpr);
    const physHeight = Math.round(window.screen.height * dpr);
    const gpuRenderer = getGPUInfo();

    // Fetch device specifications from YAML.
    const deviceData = await fetchDeviceData();

    // Build a list of candidate devices matching physical resolution (allowing for orientation).
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

    // If no candidate is found, or userAgent doesn't indicate iOS, handle as "Not iPhone/iPad"
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad/.test(ua);

    if (!isIOS || candidates.length === 0) {
        updateUI(
            "Not an iPhone or iPad",
            `${physWidth} x ${physHeight}`,
            gpuRenderer,
            "N/A",
            "N/A"
        );
        return;
    }

    // If exactly one candidate, pick it. If multiple, attempt to narrow with GPU name.
    let selectedDevice = candidates.length === 1 ? candidates[0] : null;
    if (candidates.length > 1) {
        const filtered = candidates.filter(candidate => {
            return candidate.specs.gpu && gpuRenderer.includes(candidate.specs.gpu);
        });
        selectedDevice = filtered.length > 0 ? filtered[0] : candidates[0];
    }

    // If no device is identified, fallback
    if (!selectedDevice) {
        updateUI(
            "Unknown Apple Device",
            `${physWidth} x ${physHeight}`,
            gpuRenderer,
            hasProMotion() ? "Yes (120Hz)" : "No",
            "No"
        );
        return;
    }

    // Use WebGL GPU if not masked, otherwise fallback to YAML
    let finalGPU = gpuRenderer === "Apple GPU" ? selectedDevice.specs.gpu : gpuRenderer;

    // Determine ProMotion from YAML + heuristic
    const fromYaml = (selectedDevice.specs.promotion || "").toLowerCase() === "true";
    const finalPromotion = fromYaml && hasProMotion() ? "Yes (120Hz)" : "No";

    // Determine Dynamic Island
    const finalDynamicIsland = hasDynamicIsland(selectedDevice.device) ? "Yes" : "No";

    // Update UI
    updateUI(
        selectedDevice.device,
        `${physWidth} x ${physHeight}`,
        finalGPU,
        finalPromotion,
        finalDynamicIsland
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
