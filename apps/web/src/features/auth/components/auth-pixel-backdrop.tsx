'use client'

import { useEffect, useRef, useState } from 'react'

const vertexShaderSource = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

const fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec3 uColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uPixelJitter;
uniform float uEdgeFade;

out vec4 fragColor;

float bayer2(vec2 value) {
  value = floor(value);
  return fract(value.x / 2.0 + value.y * value.y * 0.75);
}

#define BAYER4(value) (bayer2(0.5 * (value)) * 0.25 + bayer2(value))
#define BAYER8(value) (BAYER4(0.5 * (value)) * 0.25 + bayer2(value))

float hash11(float value) {
  return fract(sin(value) * 43758.5453);
}

float valueNoise(vec3 point) {
  vec3 cell = floor(point);
  vec3 position = fract(point);
  float n000 = hash11(dot(cell + vec3(0.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n100 = hash11(dot(cell + vec3(1.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n010 = hash11(dot(cell + vec3(0.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n110 = hash11(dot(cell + vec3(1.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
  float n001 = hash11(dot(cell + vec3(0.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
  float n101 = hash11(dot(cell + vec3(1.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
  float n011 = hash11(dot(cell + vec3(0.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));
  float n111 = hash11(dot(cell + vec3(1.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));
  vec3 weight = position * position * position * (position * (position * 6.0 - 15.0) + 10.0);
  float x00 = mix(n000, n100, weight.x);
  float x10 = mix(n010, n110, weight.x);
  float x01 = mix(n001, n101, weight.x);
  float x11 = mix(n011, n111, weight.x);
  return mix(mix(x00, x10, weight.y), mix(x01, x11, weight.y), weight.z) * 2.0 - 1.0;
}

float noiseField(vec2 uv, float time) {
  vec3 point = vec3(uv * uScale, time);
  float amplitude = 1.0;
  float frequency = 1.0;
  float sum = 1.0;
  for (int octave = 0; octave < 5; ++octave) {
    sum += amplitude * valueNoise(point * frequency);
    frequency *= 1.25;
  }
  return sum * 0.5 + 0.5;
}

void main() {
  vec2 centered = gl_FragCoord.xy - uResolution * 0.5;
  float cellPixelSize = 8.0 * uPixelSize;
  vec2 cell = floor(centered / cellPixelSize) * cellPixelSize;
  vec2 uv = cell / uResolution * vec2(uResolution.x / uResolution.y, 1.0);
  float feed = noiseField(uv, uTime * 0.05) * 0.5 - 0.65 + (uDensity - 0.5) * 0.3;
  float dither = BAYER8(centered / uPixelSize) - 0.5;
  float visible = step(0.5, feed + dither);
  float hash = fract(sin(dot(floor(centered / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float coverage = visible * (1.0 + (hash - 0.5) * uPixelJitter);

  if (uEdgeFade > 0.0) {
    vec2 normalized = gl_FragCoord.xy / uResolution;
    float edge = min(min(normalized.x, normalized.y), min(1.0 - normalized.x, 1.0 - normalized.y));
    coverage *= smoothstep(0.0, uEdgeFade, edge);
  }

  vec3 srgb = mix(
    uColor * 12.92,
    1.055 * pow(uColor, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, uColor)
  );
  fragColor = vec4(srgb, coverage);
}`

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Could not create WebGL shader.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'WebGL shader compilation failed.'
    gl.deleteShader(shader)
    throw new Error(message)
  }
  return shader
}

export const AuthPixelBackdrop = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: 'low-power'
    })
    if (!gl) {
      setFailed(true)
      return
    }

    let vertexShader: WebGLShader | null = null
    let fragmentShader: WebGLShader | null = null
    let program: WebGLProgram | null = null
    let buffer: WebGLBuffer | null = null
    let animationFrame = 0
    let canvasVisible = true
    let disposed = false
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    try {
      vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
      fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
      program = gl.createProgram()
      if (!program) throw new Error('Could not create WebGL program.')
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || 'WebGL program linking failed.')
      }

      buffer = gl.createBuffer()
      if (!buffer) throw new Error('Could not create WebGL buffer.')
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      gl.useProgram(program)
      const position = gl.getAttribLocation(program, 'aPosition')
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
      gl.uniform3f(gl.getUniformLocation(program, 'uColor'), 0.03434, 0.39157, 0.0865)
      gl.uniform1f(gl.getUniformLocation(program, 'uScale'), 4)
      gl.uniform1f(gl.getUniformLocation(program, 'uDensity'), 1)
      gl.uniform1f(gl.getUniformLocation(program, 'uPixelJitter'), 0.75)
      gl.uniform1f(gl.getUniformLocation(program, 'uEdgeFade'), 0.38)

      const resolution = gl.getUniformLocation(program, 'uResolution')
      const pixelSize = gl.getUniformLocation(program, 'uPixelSize')
      const time = gl.getUniformLocation(program, 'uTime')
      const startedAt = performance.now()
      const render = (now = startedAt) => {
        gl.uniform1f(time, ((now - startedAt) / 1000) * 1.35)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      const animate = (now: number) => {
        if (disposed || reducedMotion || document.visibilityState !== 'visible' || !canvasVisible) return
        render(now)
        animationFrame = requestAnimationFrame(animate)
      }
      const startAnimation = () => {
        cancelAnimationFrame(animationFrame)
        if (reducedMotion) {
          render()
        } else if (document.visibilityState === 'visible' && canvasVisible) {
          animationFrame = requestAnimationFrame(animate)
        }
      }
      const resize = () => {
        const bounds = canvas.getBoundingClientRect()
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const width = Math.min(Math.max(Math.round(bounds.width * ratio), 1), 4096)
        const height = Math.min(Math.max(Math.round(bounds.height * ratio), 1), 4096)
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
          gl.viewport(0, 0, width, height)
        }
        gl.uniform2f(resolution, width, height)
        gl.uniform1f(pixelSize, 5 * ratio)
        render()
      }
      const onVisibilityChange = () => startAnimation()
      const resizeObserver = new ResizeObserver(resize)
      const intersectionObserver = new IntersectionObserver(entries => {
        canvasVisible = entries[0]?.isIntersecting ?? true
        startAnimation()
      })
      resizeObserver.observe(canvas)
      intersectionObserver.observe(canvas)
      document.addEventListener('visibilitychange', onVisibilityChange)
      resize()
      startAnimation()

      return () => {
        disposed = true
        cancelAnimationFrame(animationFrame)
        resizeObserver.disconnect()
        intersectionObserver.disconnect()
        document.removeEventListener('visibilitychange', onVisibilityChange)
        if (buffer) gl.deleteBuffer(buffer)
        if (program) gl.deleteProgram(program)
        if (vertexShader) gl.deleteShader(vertexShader)
        if (fragmentShader) gl.deleteShader(fragmentShader)
      }
    } catch {
      setFailed(true)
      if (buffer) gl.deleteBuffer(buffer)
      if (program) gl.deleteProgram(program)
      if (vertexShader) gl.deleteShader(vertexShader)
      if (fragmentShader) gl.deleteShader(fragmentShader)
    }
  }, [])

  return (
    <div className='relative size-full overflow-hidden bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.14),transparent_68%)]'>
      <canvas
        ref={canvasRef}
        className={failed ? 'hidden' : 'block size-full'}
        aria-hidden='true'
        data-webgl-fallback={failed || undefined}
        data-testid='auth-pixel-canvas'
      />
    </div>
  )
}
