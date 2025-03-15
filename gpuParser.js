/**
 * Parse a WebGL unmasked renderer string into its components.
 *
 * Expected ANGLE string format:
 *   "ANGLE (Vendor, ANGLE Type: GPU Model, GPU Version)"
 * or
 *   "ANGLE (Vendor, ANGLE Type, GPU Model, GPU Version)"
 *
 * For non-ANGLE strings, a basic fallback is provided.
 *
 * @param {string} rendererString - The unmasked renderer string.
 * @returns {object} An object with keys: vendor, angleType, gpu, gpuVersion.
 */
function parseRendererInfo(rendererString) {
    const result = {
      vendor: '',
      angleType: '',
      gpu: '',
      gpuVersion: ''
    };
  
    if (rendererString.startsWith("ANGLE")) {
      // Regex breakdown:
      // ^ANGLE\s*\(         --> Matches "ANGLE (" with optional spaces.
      // ([^,]+),            --> Captures the GPU vendor until the first comma.
      // \s*([^,]+)          --> Captures the ANGLE type until the next comma.
      // (?:\s*:\s*([^,]+))?  --> Optionally captures the GPU model if a colon is present.
      // ,\s*([^,]+)         --> Captures the GPU version (possibly with a leading "Version" prefix).
      // \s*\)$              --> Matches the closing parenthesis.
      const regex = /^ANGLE\s*\(\s*([^,]+),\s*([^,]+)(?:\s*:\s*([^,]+))?,\s*([^,]+)\s*\)$/;
      const match = rendererString.match(regex);
      if (match) {
        result.vendor = match[1].trim();
        result.angleType = match[2].trim();
        // Capture GPU model if available
        result.gpu = match[3] ? match[3].trim() : "";
        result.gpuVersion = match[4].trim().replace(/^Version\s+/i, "");
        
        // If GPU model is not provided, infer it from the ANGLE type.
        if (!result.gpu && result.angleType) {
          // Remove the "ANGLE" prefix if it exists and trim the result.
          result.gpu = result.angleType.replace(/^ANGLE\s*/i, '').trim();
        }
        return result;
      }
    }
    
    // Fallback for non-ANGLE strings (e.g., "Mesa DRI Intel(R) HD Graphics 520")
    // This heuristic searches for common vendor names.
    const vendors = ["Intel", "AMD", "NVIDIA", "Apple"];
    for (let vendor of vendors) {
      if (rendererString.indexOf(vendor) !== -1) {
        result.vendor = vendor;
        break;
      }
    }
    result.gpu = rendererString;
    return result;
  }
  
  /**
   * Retrieve GPU info via WebGL and parse it.
   * @returns {object} An object with keys: WEBGL_MASKED, vendor, angleType, gpu, gpuVersion.
   */
  export function getParsedGPUInfo() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    let rendererString = "";
    let WEBGL_MASKED = true;
  
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        rendererString = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        WEBGL_MASKED = false;
      } else {
        const vendor = gl.getParameter(gl.VENDOR);
        const renderer = gl.getParameter(gl.RENDERER);
        rendererString = `${renderer} (${vendor})`;
      }
    } else {
      rendererString = "Unknown GPU";
    }
    
    const parsedInfo = parseRendererInfo(rendererString);
    return { WEBGL_MASKED, ...parsedInfo };
  }
  