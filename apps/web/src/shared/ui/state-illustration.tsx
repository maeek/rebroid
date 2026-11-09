type StateIllustrationKind = 'unavailable' | 'not-found' | 'error'

const DisconnectedServer = () => (
  <>
    <rect
      x='65'
      y='24'
      width='110'
      height='90'
      rx='12'
      className='fill-control stroke-foreground-muted'
    />
    <path
      d='M65 54h110M65 84h110'
      className='stroke-control-border-strong'
    />
    <path
      d='M82 39h25m-25 30h25m-25 30h25'
      className='stroke-foreground-subtle'
    />
    <path
      d='M153 39h5m-5 30h5m-5 30h5'
      className='stroke-foreground-muted'
    />
    <path
      d='M94 114v14H62a16 16 0 0 1-16-16V94m100 20v14h32'
      className='stroke-foreground-subtle'
    />
    <g
      transform='rotate(-16 46 88)'
      className='fill-control stroke-foreground-muted'
    >
      <path d='M38 77v-8m16 8v-8' />
      <path d='M35 77h22v10a11 11 0 0 1-22 0Z' />
    </g>
    <path
      d='m34 55-4-6m17 5 1-8m11 12 6-5'
      className='stroke-foreground-subtle'
    />
    <circle
      cx='184'
      cy='128'
      r='6'
      className='fill-control stroke-foreground-subtle'
    />
  </>
)

const MissingResource = () => (
  <>
    <path
      d='m65 63 47-24 47 24v57l-47 23-47-23Z'
      className='fill-control stroke-foreground-muted'
    />
    <path
      d='m65 63 47 24 47-24m-47 24v56'
      className='stroke-foreground-subtle'
    />
    <path
      d='m65 63-17-16 47-24 17 16 18-16 46 24-17 16'
      className='fill-surface-editor stroke-foreground-muted'
    />
    <path
      d='m87 98 11 6m-11 3 11 6'
      className='stroke-foreground-subtle'
    />
    <circle
      cx='165'
      cy='88'
      r='27'
      className='fill-surface-elevated stroke-foreground-muted'
    />
    <path
      d='m184 108 17 19'
      strokeWidth='7'
      className='stroke-control-border-strong'
    />
    <path
      d='M155 88h20'
      className='stroke-foreground-subtle'
    />
  </>
)

const InterruptedPage = () => (
  <>
    <rect
      x='47'
      y='29'
      width='146'
      height='100'
      rx='12'
      className='fill-control stroke-foreground-muted'
    />
    <path
      d='M47 52h146'
      className='stroke-control-border-strong'
    />
    <path
      d='M61 41h1m8 0h1m8 0h1'
      strokeWidth='3'
      className='stroke-foreground-subtle'
    />
    <rect
      x='63'
      y='68'
      width='35'
      height='44'
      rx='5'
      stroke='none'
      className='fill-surface-editor'
    />
    <path
      d='M113 72h55m-55 13h37m-37 13h17'
      className='stroke-foreground-subtle'
    />
    <path
      d='m150 113 12-20a5 5 0 0 1 8 0l19 32a5 5 0 0 1-4 8h-38a5 5 0 0 1-4-8l3-5'
      className='fill-surface-elevated stroke-foreground-muted'
    />
    <path
      d='M166 104v10m0 8v1'
      className='stroke-foreground-muted'
    />
  </>
)

/** Local, theme-aware artwork remains available when runtime services are offline. */
export const StateIllustration = ({ kind }: { kind: StateIllustrationKind }) => (
  <svg
    aria-hidden='true'
    focusable='false'
    viewBox='0 0 240 168'
    fill='none'
    strokeWidth='1.8'
    strokeLinecap='round'
    strokeLinejoin='round'
    className='h-auto w-56 max-w-full sm:w-64'
    data-slot='state-illustration'
  >
    <ellipse
      cx='120'
      cy='145'
      rx='83'
      ry='7'
      className='fill-surface-editor'
    />
    <path
      d='M26 111h8m-4-4v8m170-77h8m-4-4v8M207 76h5M27 33h5'
      className='stroke-control-border-strong'
    />
    {kind === 'unavailable' ? <DisconnectedServer /> : null}
    {kind === 'not-found' ? <MissingResource /> : null}
    {kind === 'error' ? <InterruptedPage /> : null}
  </svg>
)
