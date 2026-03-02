import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const line_id = Deno.env.get('LINE_CHANNEL_ID')
  const line_secret = Deno.env.get('LINE_CHANNEL_SECRET')
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const user_id = url.searchParams.get('state') 
  // ★ここにNetlifyの本番URLを入力
  const netlify_url = "https://toremoni-testsite-fromgithub.netlify.app"; 

  // 1. LINEの許可画面（内部IDのみ）へ飛ばす
  if (!code) {
    const redirect_uri = `https://nnugdjrhmvbyjyibdaog.supabase.co/functions/v1/line-auth`
    const authUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${line_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=openid&state=${user_id}`
    return new Response(null, { status: 302, headers: { Location: authUrl } })
  }

  // 2. IDを取得してDB更新、サイトへ戻す
  try {
    const redirect_uri = `https://nnugdjrhmvbyjyibdaog.supabase.co/functions/v1/line-auth`
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri, client_id: line_id!, client_secret: line_secret! }),
    })
    const tokenData = await tokenRes.json()
    const line_user_id = JSON.parse(atob(tokenData.id_token.split('.')[1])).sub

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await supabase.from('profiles').update({ line_user_id: line_user_id }).eq('id', user_id)

    return new Response(null, { status: 302, headers: { Location: netlify_url } })
  } catch (e) {
    return new Response("Error: " + e.message, { status: 500 })
  }
})
