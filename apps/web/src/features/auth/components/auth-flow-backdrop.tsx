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
out vec4 fragColor;

void main() {
  vec2 position = gl_FragCoord.xy / uResolution;
  vec2 uv = position - vec2(0.38, 0.4);
  uv.x *= uResolution.x / uResolution.y;
  float time = uTime * 0.24;
  float angle = atan(uv.y, uv.x);
  float radius = length(uv);
  float contour = radius - 0.43 - sin(angle * 3.0 + time) * 0.04
    - sin(angle * 5.0 - time * 0.8) * 0.02;
  float spacing = contour * 100.0;
  float distanceToLine = abs(fract(spacing) - 0.5);
  float line = 1.0 - smoothstep(0.05, 0.05 + fwidth(spacing), distanceToLine);
  float ribbon = exp(-pow(contour / 0.13, 2.0));
  float glow = exp(-pow(contour / 0.22, 2.0)) * 0.14;
  float light = 0.65 + 0.35 * sin(angle * 2.0 - time);
  float edges = smoothstep(0.0, 0.16, position.x)
    * smoothstep(0.0, 0.16, 1.0 - position.x)
    * smoothstep(0.0, 0.12, position.y)
    * smoothstep(0.0, 0.12, 1.0 - position.y);
  vec3 color = mix(uColor, vec3(0.2, 0.72, 1.0), 0.5 + 0.5 * cos(angle - time * 0.2));
  color = mix(color, vec3(0.7, 1.0, 0.85), ribbon * light * 0.3);
  float formFade = 1.0 - smoothstep(0.45, 0.95, position.x) * 0.7;
  float contentFade = mix(1.0, 0.45, smoothstep(0.45, 0.8, position.y));
  fragColor = vec4(color, (ribbon * (0.12 + line * 0.85) * light + glow) * edges * formFade * contentFade);
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

export const AuthFlowBackdrop = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      // The fragment shader outputs straight alpha, including transparent pixels.
      premultipliedAlpha: false,
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
      gl.uniform3f(gl.getUniformLocation(program, 'uColor'), 0.2, 0.8, 0.48)

      const resolution = gl.getUniformLocation(program, 'uResolution')
      const time = gl.getUniformLocation(program, 'uTime')
      const startedAt = performance.now()
      const render = (now = startedAt) => {
        gl.uniform1f(time, ((now - startedAt) / 1000) * 1.35)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
      let lastFrameAt = 0
      const animate = (now: number) => {
        if (disposed || reducedMotion || document.visibilityState !== 'visible' || !canvasVisible) return
        if (now - lastFrameAt >= 1000 / 30) {
          render(now)
          lastFrameAt = now
        }
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
        // Apply the texture limit uniformly so CSS scaling preserves the artwork proportions.
        const ratio = Math.min(window.devicePixelRatio || 1, 2, 2560 / Math.max(bounds.width, bounds.height, 1))
        const width = Math.max(Math.round(bounds.width * ratio), 1)
        const height = Math.max(Math.round(bounds.height * ratio), 1)
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
          gl.viewport(0, 0, width, height)
        }
        gl.uniform2f(resolution, width, height)
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
    <div className='relative size-full overflow-hidden'>
      <canvas
        ref={canvasRef}
        className={failed ? 'hidden' : 'block size-full'}
        aria-hidden='true'
        data-webgl-fallback={failed || undefined}
        data-testid='auth-flow-canvas'
      />
    </div>
  )
}
