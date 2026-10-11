import drawing from '../../assets/images/launch-drawing-masks/drawing.json';

const vertexSource = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;
const fragmentSource = `
precision highp float;
uniform sampler2D mask0;
uniform sampler2D mask1;
uniform vec2 viewport;
uniform vec2 phase;
uniform float ratio;
uniform vec4 crop0;
uniform vec4 crop1;
uniform vec2 sheet0;
uniform vec2 sheet1;
uniform vec4 offsets0;
uniform vec4 offsets1;
uniform vec2 progress;
float coverage(sampler2D image, vec2 point, vec4 crop, vec2 sheet, vec2 offset) {
  vec2 local = point - crop.xy;
  if (local.x < 0.0 || local.y < 0.0 || local.x >= crop.z || local.y >= crop.w) return 0.0;
  return texture2D(image, (local + offset) / sheet).a;
}
void main() {
  vec2 point = (vec2(gl_FragCoord.x, viewport.y - gl_FragCoord.y) - phase) / ratio;
  float first = mix(coverage(mask0, point, crop0, sheet0, offsets0.xy), coverage(mask0, point, crop0, sheet0, offsets0.zw), progress.x);
  float second = mix(coverage(mask1, point, crop1, sheet1, offsets1.xy), coverage(mask1, point, crop1, sheet1, offsets1.zw), progress.y);
  float reveal = min(1.0, first + second);
  float cover = 1.0 - reveal;
  gl_FragColor = vec4(vec3(250.0 / 255.0, 249.0 / 255.0, 249.0 / 255.0) * cover, cover);
}
`;

export function createLogoRenderer(
  canvas: HTMLCanvasElement,
  masks: HTMLImageElement[],
) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error('WebGL unavailable');
  const shaders: WebGLShader[] = [];
  const textures: WebGLTexture[] = [];
  const program = gl.createProgram()!;
  const buffer = gl.createBuffer()!;
  const dispose = () => {
    gl.useProgram(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    textures.forEach((texture) => gl.deleteTexture(texture));
    shaders.forEach((shader) => gl.deleteShader(shader));
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  };
  try {
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertexSource],
      [gl.FRAGMENT_SHADER, fragmentSource],
    ] as const) {
      const shader = gl.createShader(type)!;
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(
          gl.getShaderInfoLog(shader) ?? 'Shader compilation failed',
        );
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error('Logo shader linking failed');
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    for (const [index, image] of masks.entries()) {
      const texture = gl.createTexture()!;
      textures.push(texture);
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const format = gl.ALPHA;
      gl.texImage2D(gl.TEXTURE_2D, 0, format, format, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, `mask${index}`), index);
    }
    if (gl.getError() !== gl.NO_ERROR)
      throw new Error('Logo texture upload failed');
    drawing.strokes.forEach((stroke, index) => {
      gl.uniform4f(
        gl.getUniformLocation(program, `crop${index}`),
        stroke.crop.x,
        stroke.crop.y,
        stroke.crop.width,
        stroke.crop.height,
      );
      gl.uniform2f(
        gl.getUniformLocation(program, `sheet${index}`),
        stroke.crop.width * stroke.columns,
        stroke.crop.height * stroke.rows,
      );
    });
    const offsets = drawing.strokes.map((_, index) =>
      gl.getUniformLocation(program, `offsets${index}`),
    );
    const progress = gl.getUniformLocation(program, 'progress');
    const resize = () => {
      // Only the moving cover needs rasterization; the original stays at native density.
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.parentElement!.getBoundingClientRect();
      const x = (((rect.x * ratio) % 1) + 1) % 1,
        y = (((rect.y * ratio) % 1) + 1) % 1;
      canvas.width = Math.ceil(drawing.size * ratio + x);
      canvas.height = Math.ceil(drawing.size * ratio + y);
      // Align the cover to its backing pixel grid; no layout reads occur during drawing.
      Object.assign(canvas.style, {
        width: `${canvas.width / ratio}px`,
        height: `${canvas.height / ratio}px`,
        left: `${-x / ratio}px`,
        top: `${-y / ratio}px`,
      });
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(
        gl.getUniformLocation(program, 'viewport'),
        canvas.width,
        canvas.height,
      );
      gl.uniform2f(gl.getUniformLocation(program, 'phase'), x, y);
      gl.uniform1f(gl.getUniformLocation(program, 'ratio'), ratio);
    };
    const draw = (time: number) => {
      if (gl.isContextLost()) throw new Error('Logo context lost');
      const frames = drawing.strokes.map((stroke) => {
        const local = Math.max(0, time - stroke.startMs);
        return local >= stroke.durationMs
          ? stroke.frames.length - 1
          : Math.min(
              stroke.frames.length - 2,
              Math.floor((local * drawing.fps) / 1000),
            );
      });
      const fractions = frames.map((frame, index) => {
        const stroke = drawing.strokes[index];
        const current = stroke.frames[frame];
        const next =
          stroke.frames[Math.min(frame + 1, stroke.frames.length - 1)];
        return next === current
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                (time - stroke.startMs - current.timeMs) /
                  (next.timeMs - current.timeMs),
              ),
            );
      });
      frames.forEach((frame, index) => {
        const stroke = drawing.strokes[index];
        const next = Math.min(frame + 1, stroke.frames.length - 1);
        gl.uniform4f(
          offsets[index],
          (frame % stroke.columns) * stroke.crop.width,
          Math.floor(frame / stroke.columns) * stroke.crop.height,
          (next % stroke.columns) * stroke.crop.width,
          Math.floor(next / stroke.columns) * stroke.crop.height,
        );
      });
      // Interpolate only the moving reveal edge, including on 90/120 Hz displays.
      gl.uniform2f(progress, fractions[0], fractions[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    resize();
    draw(0);
    gl.finish();
    return { draw, resize, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
