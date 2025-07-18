export const SquircleSVG = () => (
  <svg
    width='10'
    height='10'
    viewBox='0 0 10 10'
  >
    <clipPath
      id='squircleClip'
      clipPathUnits='objectBoundingBox'
    >
      <path
        fill='red'
        stroke='none'
        d='M 0,0.5
                 C 0,0.13 0.13,0 0.5,0
                 S 1,0.13 1,0.5
                 0.87,1 0.5,1
                 0,0.87 0,0.5'
      />
    </clipPath>
  </svg>
)
