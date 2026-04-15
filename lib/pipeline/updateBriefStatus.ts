import { createClient } from '@/lib/supabase/client'

export interface BriefStatusUpdate {
  pipeline_status?: string
  internal_status?: string
  draft_url?: string
}

/**
 * Maps a pipeline_status change to the correct internal_status.
 * Both fields are always written together in a single update call.
 */
function deriveInternalStatus(pipeline_status: string): string {
  switch (pipeline_status) {
    case 'backlog':       return 'in_production'
    case 'in_production': return 'in_production'
    case 'qa_review':     return 'in_production'
    case 'client_review': return 'in_review'
    case 'approved':      return 'approved_by_client'
    default:              return 'in_production'
  }
}

/**
 * Single source of truth for all brief status transitions.
 * Always writes pipeline_status + internal_status together.
 * Never updates one without the other.
 */
export async function updateBriefStatus(
  briefId: string,
  updates: BriefStatusUpdate
): Promise<BriefStatusUpdate> {
  const supabase = createClient()

  const fullUpdates: BriefStatusUpdate = { ...updates }

  // If pipeline_status is changing and internal_status isn't explicitly set,
  // derive the correct internal_status from the pipeline_status
  if (updates.pipeline_status && !updates.internal_status) {
    fullUpdates.internal_status = deriveInternalStatus(updates.pipeline_status)
  }

  const { error } = await supabase
    .from('briefs')
    .update(fullUpdates)
    .eq('id', briefId)

  if (error) throw error
  return fullUpdates
}
