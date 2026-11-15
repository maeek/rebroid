const fadeTransitionClassName = 'transition-opacity duration-120 ease-[ease-out] motion-reduce:[transition:none]'

export const fieldFeedbackClassName = `${fadeTransitionClassName} opacity-0 data-[visible=true]:opacity-100`

export const popupFadeClassName =
  fadeTransitionClassName + ' opacity-100 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0'
