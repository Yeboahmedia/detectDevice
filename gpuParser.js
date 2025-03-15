// gpuParser.js

/**
 * Parse a WebGL unmasked renderer string into its components.
 * [Your existing parseRendererInfo code here]
 */
function parseRendererInfo(rendererString) {
    const result = {
      vendor: '',
      angleType: '',
      gpu: '',
      gpuVersion: ''
    };
  
    if (rendererString.startsWith("ANGLE")) {
      const regex = /^ANGLE\s*\(\s*([^,]+),\s*([^,]+)(?:\s*:\s*([^,]+))?,\s*([^,]+)\s*\)$/;
      const match = rendererString.match(regex);
      if (match) {
        result.vendor = match[1].trim();
        result.angleType = match[2].trim();
        result.gpu = match[3] ? match[3].trim() : "";
        result.gpuVersion = match[4].trim().replace(/^Version\s+/i, "");
        return result;
      }
    }
    
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
  