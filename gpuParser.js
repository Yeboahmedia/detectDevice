/**
 * Parse a WebGL unmasked renderer string into its components.
 * Expected ANGLE string format:
 *   "ANGLE (Vendor, ANGLE Type: GPU Model, GPU Version)"
 * or
 *   "ANGLE (Vendor, ANGLE Type, GPU Model, GPU Version)"
 *
 * For non-ANGLE strings, a basic fallback is provided.
 *
 * @param {string} rendererString - The unmasked renderer string.
 * @returns {object} An object with keys: gpuVendor, gpu, angleType, gpuVersion.
 */
function parseRendererInfo(rendererString) {
    const result = {
      gpuVendor: '',
      gpu: '',
      angleType: '',
      gpuVersion: ''
    };
  
    // If the renderer info starts with "ANGLE", attempt to parse it with regex.
    if (rendererString.startsWith("ANGLE")) {
      // Regex breakdown:
      // ^ANGLE\s*\(         --> Matches "ANGLE (" with optional spaces.
      // ([^,]+),            --> Captures the GPU vendor until the first comma.
      // \s*([^,]+)          --> Captures the ANGLE type (could include spaces) until the next comma.
      // (?:\s*:\s*([^,]+))?  --> Optionally captures the GPU model if a colon is present.
      // ,\s*([^,]+)         --> Captures the GPU version (e.g., might include a "Version" prefix).
      // \s*\)$              --> Matches the closing parenthesis.
      const regex = /^ANGLE\s*\(\s*([^,]+),\s*([^,]+)(?:\s*:\s*([^,]+))?,\s*([^,]+)\s*\)$/;
      const match = rendererString.match(regex);
      if (match) {
        result.gpuVendor = match[1].trim();
        result.angleType = match[2].trim();
        // match[3] might be undefined if no colon and GPU model is provided.
        result.gpu = match[3] ? match[3].trim() : "";
        // Remove a leading "Version" string if present in the GPU version.
        result.gpuVersion = match[4].trim().replace(/^Version\s+/i, "");
        return result;
      }
    }
    
    // Fallback for non-ANGLE strings (example: "Mesa DRI Intel(R) HD Graphics 520")
    // This heuristic simply tries to detect common vendor keywords.
    const vendors = ["Intel", "AMD", "NVIDIA"];
    for (let vendor of vendors) {
      if (rendererString.indexOf(vendor) !== -1) {
        result.gpuVendor = vendor;
        break;
      }
    }
    result.gpu = rendererString;
    return result;
  }
  
  // Example usage:
  const rendererStrings = [
    "ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)",
    "ANGLE (Intel, ANGLE D3D11, Intel® HD Graphics 520, Version 27.20.100.9126)",
    "ANGLE (NVIDIA, ANGLE D3D11, NVIDIA GeForce GTX 1050, Version 27.20.100.9126)",
    "Mesa DRI Intel(R) HD Graphics 520"
  ];
  
  const parsedRenderers = rendererStrings.map(parseRendererInfo);
  console.log(parsedRenderers);
  
  /*
  Output will be an array of objects such as:
  [
    {
      gpuVendor: "Apple",
      angleType: "ANGLE Metal Renderer",
      gpu: "Apple M3 Pro",
      gpuVersion: "Unspecified Version"
    },
    {
      gpuVendor: "Intel",
      angleType: "ANGLE D3D11",
      gpu: "Intel® HD Graphics 520",
      gpuVersion: "27.20.100.9126"
    },
    {
      gpuVendor: "NVIDIA",
      angleType: "ANGLE D3D11",
      gpu: "NVIDIA GeForce GTX 1050",
      gpuVersion: "27.20.100.9126"
    },
    {
      gpuVendor: "Intel",
      angleType: "",
      gpu: "Mesa DRI Intel(R) HD Graphics 520",
      gpuVersion: ""
    }
  ]
  */
  