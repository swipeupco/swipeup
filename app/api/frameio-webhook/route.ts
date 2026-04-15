export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Frame.io webhook endpoint.
 *
 * Configure in Frame.io → Team Settings → Webhooks:
 *   URL:    https://<your-hub-domain>/api/frameio-webhook
 *   Secret: set FRAMEIO_WEBHOOK_SECRET in env, leave blank to skip verification
 *   Events: review_link.created, asset.ready
 *
 * Matching logic: the asset name (or review link name) must contain the brief
 * name (case-insensitive). The first matching brief wins.
 *
 * On match:
 *   - Sets draft_url to the Frame.io review link
 *   - Advances internal_status to 'ready_for_review' if it was 'in_production'
 */
export async function POST(request: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const body = await request.json()
    const eventType: string = body.type ?? ''

    // ── Extract review URL and asset name from payload ──────────────────────
    let reviewUrl: string | null = null
    let assetName: string | null = null

    if (eventType === 'review_link.created') {
      reviewUrl = body.resource?.short_url ?? body.resource?.url ?? null
      assetName = body.resource?.name
        ?? body.resource?.items?.[0]?.asset?.name
        ?? null
    } else if (eventType === 'asset.ready') {
      // asset.ready doesn't carry a review link — use the asset viewer URL
      const assetId = body.resource?.id
      assetName = body.resource?.name ?? null
      if (assetId) {
        reviewUrl = `https://app.frame.io/reviews/${assetId}`
      }
    } else {
      // Unrecognised event — acknowledge and ignore
      return NextResponse.json({ received: true, matched: false, reason: 'unhandled_event_type' })
    }

    if (!reviewUrl || !assetName) {
      return NextResponse.json({ received: true, matched: false, reason: 'missing_url_or_name' })
    }

    // ── Fetch all non-approved briefs to match against ──────────────────────
    const { data: briefs, error } = await supabaseAdmin
      .from('briefs')
      .select('id, name, internal_status')
      .neq('pipeline_status', 'approved')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ── Match: assetName contains brief name (case-insensitive) ─────────────
    const needle = assetName.toLowerCase()
    const match = briefs?.find(b => needle.includes(b.name.toLowerCase()))

    if (!match) {
      return NextResponse.json({
        received: true,
        matched: false,
        reason: 'no_brief_matched',
        assetName,
      })
    }

    // ── Update brief ─────────────────────────────────────────────────────────
    const updates: Record<string, string> = { draft_url: reviewUrl }

    // Only advance status if still in early production stage
    if (match.internal_status === 'in_production' || match.internal_status == null) {
      updates.internal_status = 'ready_for_review'
    }

    const { error: updateError } = await supabaseAdmin
      .from('briefs')
      .update(updates)
      .eq('id', match.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      received: true,
      matched: true,
      briefId: match.id,
      briefName: match.name,
      draftUrl: reviewUrl,
      statusAdvanced: !!updates.internal_status,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Frame.io sends a GET to verify the endpoint during setup
export async function GET() {
  return NextResponse.json({ ok: true, service: 'swipeup-frameio-webhook' })
}
