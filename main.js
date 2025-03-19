import { 
  isMacDevice, fetchDeviceData, extractSecUA, checkColorGamut, 
  detectProMotion, getScreenInfo, getParsedGPUInfo, initializeWebGPU
} from "./src/computeDeviceInfo.js";
import { parseDevices } from "./src/DeviceParser.js";
import { dynamicFilterDevices } from "./src/filter.js";

(async function () {
  async function detectAppleDevice() {
    // Determine if the device is a Mac.
    const isMac = isMacDevice();
    const screenInfo = getScreenInfo(isMac);

    // Fetch device data based on device type.
    const devices = await fetchDeviceData(isMac ? "mac" : "mobile");
    // Get logical dimensions (points) and scale factor.
    const {logicalWidth,logicalHeight,scaleFactor,computedDiagonalInches} = screenInfo;
    // Parse GPU info.
    const parsedGPUInfo = getParsedGPUInfo();

    // Measure frame rate for ProMotion detection.
    const measuredProMotion = await detectProMotion();

    // Initialize WebGPU.
    const webGPUResult = await initializeWebGPU();
    let mergedInfo = 'n/a'
    if (webGPUResult.success && webGPUResult.adapterType) {
      const { vendor, architecture, device, description } = webGPUResult.adapterType.info;
      mergedInfo = `Vendor: ${vendor}, Architecture: ${architecture}, Device: ${device}, Description: ${description}`;
      console.log(mergedInfo);
    } else {
      console.error("Failed to initialize WebGPU or adapter info is missing.");
    }

    
    // Check the display's color gamut.
    const colorGamutInfo = checkColorGamut();

   
    // Filter devices based on various criteria.
    let filteredDevices = dynamicFilterDevices(
      devices,
      isMac,
      "Deep",
      logicalWidth,
      logicalHeight,
      0,         // logicalTolerance
      scaleFactor,
      computedDiagonalInches,
      0.02,      // diagonalTolerance
      colorGamutInfo
    );

    

    // Extract device names and parse them.
    let deviceNames = filteredDevices.map((device) => device.device);
    deviceNames = parseDevices(deviceNames);

    // Extract all available UA data.
    const uaData = await extractSecUA();
    let uaInfoDisplay = "N/A";
    if (uaData) {
      uaInfoDisplay = Object.entries(uaData)
        .map(([key, value]) => {
          return typeof value === "object" && value !== null
            ? `${key}: ${JSON.stringify(value)}`
            : `${key}: ${value}`;
        })
        .join(", ");
    }


    const promotionStr = measuredProMotion;
    const resolutionStr = `${logicalWidth} x ${logicalHeight} (Scale: ${scaleFactor})`;

    // Update the UI with the detected information.
    function updateUI(deviceName, resolution, diagonalInches, isMac, gpuInfo, refreshRate, uaInfo, colorGamut, wGPU) {
      document.getElementById("device-name").innerText = deviceName;
      document.getElementById("screen-size").innerText = resolution;
      document.getElementById("screen-diagonal").innerText = diagonalInches.toFixed(2) + " inches";
      document.getElementById("is-this-mac").innerText = isMac;
      document.getElementById("gpu-info").innerText = gpuInfo.gpu;
      document.getElementById("wGPU").innerText = wGPU;
      document.getElementById("promotion").innerText = refreshRate;
      document.getElementById("sec-ua-info").innerText = uaInfo;
      document.getElementById("color-gamut").innerText = colorGamut;
    }

    updateUI(
      deviceNames,resolutionStr, computedDiagonalInches,
      isMac, parsedGPUInfo, promotionStr, uaInfoDisplay,colorGamutInfo, mergedInfo
    );
  }

  // Start the detection process.
  detectAppleDevice();
})();
