'use client'

export const optimizeIconFile = (file: File, size = 256) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Could not prepare icon canvas.'))
        return
      }

      const sourceSize = Math.min(image.width, image.height)
      const sourceX = (image.width - sourceSize) / 2
      const sourceY = (image.height - sourceSize) / 2
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size)
      resolve(canvas.toDataURL('image/webp', 0.9))
    }
    image.onerror = () => reject(new Error('Could not load icon image.'))
    image.src = URL.createObjectURL(file)
  })
