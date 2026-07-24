import type { ViewerRendererBackend } from "./types.js";

export interface VideoFrameRenderer {
  readonly backend: ViewerRendererBackend;
  draw(frame: VideoFrame, width: number, height: number): void;
  close(): void;
}

class Canvas2dVideoFrameRenderer implements VideoFrameRenderer {
  readonly backend = "webcodecs-webgl2-fallback" as const;
  private readonly context: OffscreenCanvasRenderingContext2D;

  constructor(private readonly canvas: OffscreenCanvas) {
    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    if (!context) {
      throw new Error("OffscreenCanvas 2D rendering is unavailable.");
    }
    this.context = context;
  }

  draw(frame: VideoFrame, width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.context.drawImage(frame, 0, 0, width, height);
  }

  close(): void {}
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Could not create WebGL display shader.");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message =
      gl.getShaderInfoLog(shader) || "WebGL shader compilation failed.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

class WebGlVideoFrameRenderer implements VideoFrameRenderer {
  readonly backend = "chromium-webcodecs" as const;
  private readonly program: WebGLProgram;
  private readonly texture: WebGLTexture;

  constructor(
    private readonly canvas: OffscreenCanvas,
    private readonly gl: WebGL2RenderingContext,
  ) {
    const vertex = compileShader(
      gl,
      gl.VERTEX_SHADER,
      `#version 300 es
      in vec2 position;
      in vec2 textureCoordinate;
      out vec2 videoCoordinate;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
        videoCoordinate = textureCoordinate;
      }`,
    );
    const fragment = compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      `#version 300 es
      precision mediump float;
      uniform sampler2D videoTexture;
      in vec2 videoCoordinate;
      out vec4 outputColor;
      void main() {
        outputColor = texture(videoTexture, videoCoordinate);
      }`,
    );
    const program = gl.createProgram();
    if (!program) {
      throw new Error("Could not create WebGL display program.");
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "WebGL link failed.");
    }
    this.program = program;
    gl.useProgram(program);

    const vertices = new Float32Array([
      -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    const textureCoordinate = gl.getAttribLocation(
      program,
      "textureCoordinate",
    );
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(textureCoordinate);
    gl.vertexAttribPointer(textureCoordinate, 2, gl.FLOAT, false, 16, 8);

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("Could not create WebGL display texture.");
    }
    this.texture = texture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  draw(frame: VideoFrame, width: number, height: number): void {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
    this.gl.useProgram(this.program);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      frame,
    );
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    this.gl.flush();
  }

  close(): void {
    this.gl.deleteTexture(this.texture);
    this.gl.deleteProgram(this.program);
  }
}

export function createVideoFrameRenderer(
  canvas: OffscreenCanvas,
): VideoFrameRenderer {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    desynchronized: true,
    depth: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
    stencil: false,
  });
  if (gl) {
    return new WebGlVideoFrameRenderer(canvas, gl);
  }
  return new Canvas2dVideoFrameRenderer(canvas);
}
