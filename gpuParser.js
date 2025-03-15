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
 * @returns {object} An object with keys: vendor, angleType, gpu, gpuVersion.
 */
function parseRendererInfo(rendererString) {
    const result = {
      vendor: '',
      angleType: '',
      gpu: '',
      gpuVersion: ''
    };
  
    // If the renderer info starts with "ANGLE", attempt to parse it with regex.
    if (rendererString.startsWith("ANGLE")) {
      // Regex breakdown:
      // ^ANGLE\s*\(         --> Matches "ANGLE (" with optional spaces.
      // ([^,]+),            --> Captures the GPU vendor until the first comma.
      // \s*([^,]+)          --> Captures the ANGLE type until the next comma.
      // (?:\s*:\s*([^,]+))?  --> Optionally captures the GPU model if a colon is present.
      // ,\s*([^,]+)         --> Captures the GPU version (e.g., may include a "Version" prefix).
      // \s*\)$              --> Matches the closing parenthesis.
      const regex = /^ANGLE\s*\(\s*([^,]+),\s*([^,]+)(?:\s*:\s*([^,]+))?,\s*([^,]+)\s*\)$/;
      const match = rendererString.match(regex);
      if (match) {
        result.vendor = match[1].trim();
        result.angleType = match[2].trim();
        // match[3] might be undefined if no colon and GPU model is provided.
        result.gpu = match[3] ? match[3].trim() : "";
        // Remove a leading "Version" if present in the GPU version.
        result.gpuVersion = match[4].trim().replace(/^Version\s+/i, "");
        return result;
      }
    }
    
    // Fallback for non-ANGLE strings (e.g., "Mesa DRI Intel(R) HD Graphics 520 (Intel)")
    // This heuristic checks for common vendor keywords.
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
   * Retrieve WebGL GPU information with a more informative fallback.
   * @returns {object} An object with:
   *  - rendererString: the raw GPU info string.
   *  - WEBGL_MASKED: false if the unmasked renderer info was retrieved, true otherwise.
   */
  function getGPUInfo() {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return { rendererString: "Unknown GPU", WEBGL_MASKED: true };
  
    // Attempt to get detailed info using the debug extension.
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      return {
        rendererString: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
        WEBGL_MASKED: false
      };
    } else {
      // Fallback: return the standard vendor and renderer info.
      const vendor = gl.getParameter(gl.VENDOR);
      const renderer = gl.getParameter(gl.RENDERER);
      return {
        rendererString: `${renderer} (${vendor})`,
        WEBGL_MASKED: true
      };
    }
  }
  
  /**
   * Combines GPU info retrieval and parsing into one function.
   *
   * @returns {object} An object with:
   *  - WEBGL_MASKED: whether the GPU model is masked (true) or unmasked (false),
   *  - vendor: The first part before the comma,
   *  - angleType: The next part (optionally followed by a colon and the GPU model),
   *  - gpu: GPU Model (if provided),
   *  - gpuVersion: The GPU version with any leading "Version" stripped.
   */
  function getParsedGPUInfo() {
    const { rendererString, WEBGL_MASKED } = getGPUInfo();
    const parsedInfo = parseRendererInfo(rendererString);
    return { WEBGL_MASKED, ...parsedInfo };
  }
  
  // Example usage:
  console.log(getParsedGPUInfo());
  