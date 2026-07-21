import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPixelBackdrop } from './auth-pixel-backdrop'

const resizeDisconnect = vi.fn()
const intersectionDisconnect = vi.fn()
let resizeCallback: ResizeObserverCallback
let intersectionCallback: IntersectionObserverCallback
let frameId = 0

const createGl = () => {
  const shader = {}
  const program = {}
  const buffer = {}
  return {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLES: 8,
    createShader: vi.fn(() => shader),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => program),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram: vi.fn(),
    createBuffer: vi.fn(() => buffer),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),
    useProgram: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    viewport: vi.fn(),
    drawArrays: vi.fn()
  }
}

describe('AuthPixelBackdrop', () => {
  beforeEach(() => {
    frameId = 0
    resizeDisconnect.mockClear()
    intersectionDisconnect.mockClear()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback
        }
        observe = vi.fn()
        disconnect = resizeDisconnect
      }
    )
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersectionCallback = callback
        }
        observe = vi.fn()
        disconnect = intersectionDisconnect
      }
    )
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => ++frameId)
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: false }))
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      height: 50,
      top: 0,
      right: 100,
      bottom: 50,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses the semantic fallback when WebGL2 is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(<AuthPixelBackdrop />)
    const canvas = screen.getByTestId('auth-pixel-canvas')

    expect(canvas).toHaveAttribute('data-webgl-fallback', 'true')
    expect(canvas.className).toContain('hidden')
  })

  it('renders one stable frame for reduced motion and resizes with a capped pixel ratio', () => {
    const gl = createGl()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as never)
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList)
    render(<AuthPixelBackdrop />)
    const canvas = screen.getByTestId('auth-pixel-canvas')

    expect(canvas).toHaveProperty('width', 200)
    expect(canvas).toHaveProperty('height', 100)
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, 200, 100)
    expect(requestAnimationFrame).not.toHaveBeenCalled()

    act(() => resizeCallback([], {} as ResizeObserver))
    expect(gl.drawArrays).toHaveBeenCalled()
  })

  it('pauses offscreen, resumes onscreen, and releases GPU resources', () => {
    const gl = createGl()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as never)
    const { unmount } = render(<AuthPixelBackdrop />)
    const initialFrames = vi.mocked(requestAnimationFrame).mock.calls.length

    act(() =>
      intersectionCallback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
    )
    expect(vi.mocked(requestAnimationFrame).mock.calls.length).toBe(initialFrames)
    act(() => intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(vi.mocked(requestAnimationFrame).mock.calls.length).toBe(initialFrames + 1)

    unmount()
    expect(resizeDisconnect).toHaveBeenCalled()
    expect(intersectionDisconnect).toHaveBeenCalled()
    expect(gl.deleteBuffer).toHaveBeenCalled()
    expect(gl.deleteProgram).toHaveBeenCalled()
    expect(gl.deleteShader).toHaveBeenCalledTimes(2)
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})
