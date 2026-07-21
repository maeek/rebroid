import type { AutomationAiProviderModel } from '@/shared/contracts/ai-provider'

export type AiModelRecommendationLevel = 'good' | 'warning' | 'neutral'

export interface AiModelRecommendation {
  level: AiModelRecommendationLevel
  title: string
  message: string
}

const guiSpecializedPatterns = [
  /ui[-_ ]?tars/i,
  /gui[-_ ]?(owl|actor)/i,
  /uground/i,
  /omniparser/i,
  /qwen(?:2\.5|3)?[-_ ]?vl/i,
  /os[-_ ]?atlas/i
]

const generalVisionPatterns = [/gemma/i, /llava/i, /minicpm/i, /llama.*vision/i]
const toolFriendlyPatterns = [/qwen/i, /mistral/i, /llama\s*3/i, /gpt[-_ ]?oss/i]

export const recommendAiModelForAutomation = (
  model: Pick<AutomationAiProviderModel, 'id' | 'label' | 'roles'>
): AiModelRecommendation => {
  const name = `${model.id} ${model.label}`.toLowerCase()
  const hasPlanner = model.roles.includes('planner')
  const hasVision = model.roles.includes('vision')
  const guiSpecialized = guiSpecializedPatterns.some(pattern => pattern.test(name))
  const generalVision = generalVisionPatterns.some(pattern => pattern.test(name))
  const toolFriendly = toolFriendlyPatterns.some(pattern => pattern.test(name))

  if (hasVision && guiSpecialized) {
    return {
      level: 'good',
      title: 'GUI-oriented',
      message:
        'Good fit for mobile/GUI grounding. Prefer this for vision or shared planner+vision when health checks pass.'
    }
  }

  if (hasPlanner && hasVision && generalVision) {
    return {
      level: 'warning',
      title: 'General VLM',
      message:
        'May describe screenshots, but can hallucinate GUI state or coordinates. Pair with parser candidates or a GUI grounding model.'
    }
  }

  if (hasPlanner && toolFriendly && !hasVision) {
    return {
      level: 'good',
      title: 'Planner-oriented',
      message: 'Likely suitable for tool planning. Pair with a GUI-oriented vision/grounding model for screen control.'
    }
  }

  if (hasVision && !guiSpecialized) {
    return {
      level: 'neutral',
      title: 'Vision-capable',
      message:
        'Usable for screen summaries, but validate grounding through parser candidates and post-action observations.'
    }
  }

  return {
    level: 'neutral',
    title: 'Configured',
    message:
      'No GUI-specific signal detected from the model name. Use health checks and trial runs to validate role fit.'
  }
}
