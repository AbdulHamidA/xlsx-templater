// ---- DMS fork: per-render options -----------------------------------------
// Options given to renderFromBuffer()/renderFromFile() reach the image tag
// handler through a WeakMap keyed by the ExcelJS Workbook being rendered, so
// concurrent renders in one process never see each other's options and no
// mutable static state is introduced.
var RENDER_OPTIONS = new WeakMap();
var DEFAULT_IMAGE_TIMEOUT_MS = 15000;
var DEFAULT_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

function positiveNumber(value, fallback) {
  var n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Validate and normalise render options.
 * @param {object} [options]
 * @param {function} [options.imageLoader]  async (value, tag, ctx, opts) => { buffer, extension } | null
 *        Resolves an image tag's raw data value to bytes. `null` = no image
 *        (the tag is removed, nothing is drawn). Throwing marks the image as
 *        failed (see onImageError).
 * @param {function} [options.onImageError] (error, ctx) => void
 *        Called instead of console.error when an image fails; throwing from it
 *        aborts the render. When omitted the upstream behaviour applies: the
 *        error is logged and the tag is left in the cell.
 * @param {number} [options.imageTimeoutMs=15000]  default loader: fetch timeout
 * @param {number} [options.imageMaxBytes=15 MiB]   default loader: response cap
 */
function normalizeRenderOptions(options) {
  var o = options && typeof options === 'object' ? options : {};
  if (o.imageLoader !== undefined && o.imageLoader !== null && typeof o.imageLoader !== 'function') {
    throw new TypeError('xlsxtemplater: options.imageLoader must be a function');
  }
  if (o.onImageError !== undefined && o.onImageError !== null && typeof o.onImageError !== 'function') {
    throw new TypeError('xlsxtemplater: options.onImageError must be a function');
  }
  return {
    imageLoader: o.imageLoader || null,
    onImageError: o.onImageError || null,
    imageTimeoutMs: positiveNumber(o.imageTimeoutMs, DEFAULT_IMAGE_TIMEOUT_MS),
    imageMaxBytes: positiveNumber(o.imageMaxBytes, DEFAULT_IMAGE_MAX_BYTES)
  };
}

function getRenderOptions(workbook) {
  return (workbook && RENDER_OPTIONS.get(workbook)) || normalizeRenderOptions(null);
}

export { RENDER_OPTIONS, DEFAULT_IMAGE_TIMEOUT_MS, DEFAULT_IMAGE_MAX_BYTES, normalizeRenderOptions, getRenderOptions };
