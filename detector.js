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
            if (value === "true" || value === "false") value = value === "true";
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

// Detect ProMotion support via refresh rate
function hasProMotion() {
    return window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
}

// Determine if the device has a Dynamic Island (for Pro models).
function hasDynamicIsland(deviceName) {
    const lowerName = deviceName.toLowerCase();
    return lowerName.includes("14 pro") || lowerName.includes("15 pro") || lowerName.includes("16 pro");
}

// Compute aspect ratio from screen dimensions
function computeAspectRatio(width, height) {
    const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
}

// Update the UI elements on the page.
function updateUI(deviceName, resolution, gpu, promotion, dynamicIsland, webglGPU) {
    document.getElementById("device-name").innerText = deviceName;
    document.getElementById("screen-size").innerText = resolution;
    document.getElementById("gpu-info").innerText = gpu;
    document.getElementById("promotion").innerText = promotion;
    document.getElementById("dynamic-island").innerText = dynamicIsland;
}


// Match the best possible iOS device
async function detectAppleDevice() {
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = window.screen.width;
    const logicalHeight = window.screen.height;
    const physicalWidth = Math.round(logicalWidth * dpr);
    const physicalHeight = Math.round(logicalHeight * dpr);
    const ppi = Math.round((physicalWidth / logicalWidth) * 163); // Rough estimate
    const aspectRatio = computeAspectRatio(physicalWidth, physicalHeight);
    const gpuRenderer = getGPUInfo();
    const promotionSupport = hasProMotion();

    // Fetch device specs
    const deviceData = await fetchDeviceData();

    // Filter candidates by matching all available data points
    let candidates = [];
    Object.entries(deviceData).forEach(([device, specs]) => {
        if (
            Math.abs(physicalWidth - specs.physical_width) <= 10 &&
            Math.abs(physicalHeight - specs.physical_height) <= 10 &&
            Math.abs(ppi - specs.ppi) <= 10 &&
            aspectRatio === specs.aspect_ratio &&
            promotionSupport === specs["pro-motion"]
        ) {
            candidates.push(device);
        }
    });

    // Handle multiple matches
    let detectedDevice = "Unknown Apple Device";
    if (candidates.length === 1) {
        detectedDevice = candidates[0];
    } else if (candidates.length > 1) {
        detectedDevice = candidates.join(" | ");
    }

    // Update UI with detection results
    document.getElementById("device-name").innerText = detectedDevice;
    document.getElementById("screen-size").innerText = `${logicalWidth} x ${logicalHeight}`;
    document.getElementById("gpu-info").innerText = gpuRenderer;
    document.getElementById("promotion").innerText = promotionSupport ? "Yes (120Hz)" : "No";
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
