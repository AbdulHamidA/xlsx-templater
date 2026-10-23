import { DEFAULT_IMAGE_TIMEOUT_MS, DEFAULT_IMAGE_MAX_BYTES, normalizeRenderOptions } from './RenderOptions.js';

/**
 * 图像的辅助工具 / image helpers.
 *
 * DMS fork: images are resolved by a pluggable loader instead of an unguarded
 * node-fetch of an http(s) URL. The default loader understands Buffers,
 * Uint8Array/ArrayBuffer, data: URLs and http(s) URLs (global fetch with a
 * timeout and a byte cap). Hosts that must control outbound traffic pass
 * `options.imageLoader` and never let this module touch the network.
 */
class ImageUtil{
  /** png | jpeg | gif from the magic bytes, else null. */
  static sniffExtension(buf){
    if(!buf || buf.length < 4) return null;
    if(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
    if(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
    if(buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
    return null
  }

  /**
   * ExcelJS writes `image/<extension>` into [Content_Types].xml, so only the
   * three formats Excel renders are allowed and `jpg` becomes `jpeg`; anything
   * else falls back to the sniffed type, then png.
   */
  static normalizeExtension(ext, buf){
    let e = String(ext || '').toLowerCase().replace(/^\./, '');
    if(e === 'jpg') e = 'jpeg';
    if(e === 'png' || e === 'jpeg' || e === 'gif') return e;
    return ImageUtil.sniffExtension(buf) || 'png'
  }

  static toBuffer(data){
    if(Buffer.isBuffer(data)) return data;
    if(data instanceof ArrayBuffer) return Buffer.from(data);
    if(ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    return null
  }

  /**
   * Default loader. Accepts a Buffer/typed array, `{ buffer, extension }`, a
   * data: URL or an http(s) URL. Throws for anything else, for a non-2xx
   * response, on timeout, or when the body exceeds imageMaxBytes.
   */
  static async defaultImageLoader(value, tag, ctx, opts){
    opts = opts || {};
    let direct = ImageUtil.toBuffer(value);
    if(direct) return { buffer: direct, extension: ImageUtil.sniffExtension(direct) || 'png' };
    if(value && typeof value === 'object' && !Array.isArray(value)){
      let inner = ImageUtil.toBuffer(value.buffer);
      if(inner) return { buffer: inner, extension: value.extension };
    }
    if(typeof value !== 'string'){
      throw new Error('unsupported image value for {%' + tag + '}: expected a Buffer, a data: URL or an http(s) URL')
    }
    let raw = value.trim();
    let dataUrl = /^data:(image\/[a-z0-9.+-]+)?\s*;\s*base64\s*,\s*([A-Za-z0-9+/=\s]+)$/i.exec(raw);
    if(dataUrl){
      let buf = Buffer.from(dataUrl[2].replace(/\s+/g, ''), 'base64');
      let mime = (dataUrl[1] || '').toLowerCase();
      return { buffer: buf, extension: mime.startsWith('image/') ? mime.slice(6) : ImageUtil.sniffExtension(buf) }
    }
    if(!/^https?:\/\/.+/i.test(raw)){
      throw new Error('unsupported image value for {%' + tag + '}: expected a Buffer, a data: URL or an http(s) URL')
    }
    let url = raw.split(/\s+/)[0];
    let timeoutMs = opts.imageTimeoutMs || DEFAULT_IMAGE_TIMEOUT_MS;
    let maxBytes = opts.imageMaxBytes || DEFAULT_IMAGE_MAX_BYTES;
    let controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      if(!res.ok) throw new Error('image request for {%' + tag + '} failed with HTTP ' + res.status);
      let chunks = [];
      let total = 0;
      if(res.body && typeof res.body.getReader === 'function'){
        let reader = res.body.getReader();
        while(true){
          let step = await reader.read();
          if(step.done) break;
          total += step.value.byteLength;
          if(total > maxBytes){
            controller.abort();
            throw new Error('image for {%' + tag + '} exceeds ' + maxBytes + ' bytes')
          }
          chunks.push(Buffer.from(step.value));
        }
      } else {
        let arr = Buffer.from(await res.arrayBuffer());
        if(arr.length > maxBytes) throw new Error('image for {%' + tag + '} exceeds ' + maxBytes + ' bytes');
        chunks.push(arr);
      }
      return { buffer: Buffer.concat(chunks), extension: ImageUtil.getImageExt(url) }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Resolve a tag value to `{ buffer, extension }` (or null for "no image")
   * through options.imageLoader or the default loader.
   */
  static async loadImage(value, tag, ctx, opts){
    let loader = (opts && opts.imageLoader) || ImageUtil.defaultImageLoader;
    let res = await loader(value, tag, ctx, opts);
    if(res == null) return null;
    let buf = ImageUtil.toBuffer(res && res.buffer !== undefined ? res.buffer : res);
    if(!buf || !buf.length) return null;
    return { buffer: buf, extension: ImageUtil.normalizeExtension(res && res.extension, buf) }
  }

  /**
   * 通过url获取对应的图像文件数据 (kept for callers of the upstream API;
   * resolves to a Buffer instead of an ArrayBuffer — both are accepted by
   * ExcelJS addImage).
   * @param {*} url 必须是绝对路径
   */
  static getImageData(url){
    let urlPattern = /^http[s]{0,1}:\/\/.+/i;
    if(!urlPattern.test(url)){
      return Promise.reject('url格式不正确，必须是绝对路径')
    }
    return ImageUtil.defaultImageLoader(url, '', {}, normalizeRenderOptions(null)).then((r) => r.buffer)
  }

  /**
   * 获取指定图片url的后缀名
   * @param {*} url 例如
   * https://www.baidu.com/img/PCtm_d9c8750bed0b3c7d089fa7d55720d6cf.png
   * @returns png, jpg, jpeg之类的
   */
  static getImageExt(url){
    let pattern = /.+\.(\w+)$/i;
    let matches = pattern.exec(String(url).split(/[?#]/)[0]);
    if(matches && matches.length>=2){
      return matches[1]
    }
    return 'jpg'
  }
}

export { ImageUtil as default };
