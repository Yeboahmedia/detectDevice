async function fetchDeviceData() {
    const response = await fetch("devices.yaml");
    const yamlText = await response.text();
    return parseYAML(yamlText);
}

// YAML parser to extract device data
function parseYAML(yamlText) {
    const lines = yamlText.split("\n").filter(line => line.trim() && !line.startsWith("#"));
    const deviceData = {};
    
    let currentDevice = "";
    lines.forEach(line => {
        if (line.includes(":") && !line.includes("screen_size") && !line.includes("resolution") && !line.includes("gpu") && !line.includes("promotion")) {
            currentDevice = line.split(":")[0].trim();
            deviceData[currentDevice] = {};
        } else if (currentDevice) {
            const [key, value] = line.trim().split(":").map(item => item.trim());
            deviceData[currentDevice][key] = value;
        }
    });

    return deviceData;
}

// Function to detect Apple devices
async function detectAppleDevice() {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad/.test(ua);
    if (!isIOS) return "Not an iPhone or iPad";

    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const deviceData = await fetchDeviceData();

    let detectedDevice = "Unknown Apple Device";
    let detectedGPU = "Unknown GPU";
    let detectedProMotion = "Unknown";

    // Matching the device based on screen resolution
    Object.entries(deviceData).forEach(([device, specs]) => {
        const [resWidth, resHeight] = specs.resolution.split("x").map(n => parseInt(n, 10));
        if (
            (screenWidth === resWidth && screenHeight === resHeight) ||
            (screenWidth === resHeight && screenHeight === resWidth) // Landscape check
        ) {
            detectedDevice = device;
            detectedGPU = specs.gpu;
            detectedProMotion = specs.promotion === "true" ? "Yes (120Hz)" : "No";
        }
    });

    // WebGL GPU detection
    function getGPUInfo() {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (!gl) return "Unknown GPU";
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        return debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "Apple GPU";
    }

    const gpuRenderer = getGPUInfo();

    // If Apple hides GPU details, use YAML-based detection
    if (gpuRenderer === "Apple GPU" && detectedDevice !== "Unknown Apple Device") {
        detectedGPU = deviceData[detectedDevice]?.gpu || "Apple GPU (Limited Info)";
    } else {
        detectedGPU = gpuRenderer;
    }

    // Update UI
    document.getElementById("device-name").innerText = detectedDevice;
    document.getElementById("screen-size").innerText = `${screenWidth} x ${screenHeight}`;
    document.getElementById("gpu-info").innerText = detectedGPU;
    document.getElementById("promotion").innerText = detectedProMotion;
}

// Run detection on page load
detectAppleDevice();
