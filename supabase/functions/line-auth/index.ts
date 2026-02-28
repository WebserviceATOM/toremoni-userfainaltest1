import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const line_id = Deno.env.get('LINE_CHANNEL_ID')
  const line_secret = Deno.env.get('LINE_CHANNEL_SECRET')
  const supabase_url = Deno.env.get('SUPABASE_URL')
  const supabase_service_role = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const user_id = url.searchParams.get('state') 
  
  // ★重要：ここを自分のNetlifyのURLに書き換えてください（最後は / なし）
  const NETLIFY_URL = "https://toremoni-testsite.netlify.app"; 

  // --- A. LINEの許可画面へ飛ばす処理 ---
  if (!code) {
    if (!user_id) return new Response("Error: No User ID provided", { status: 400 })
    
    // 東京プロジェクトIDを使ったリダイレクト先
    const redirect_uri = `https://nnugdjrhmvbyjyibdaog.supabase.co/functions/v1/line-auth`
    
    // scope=openid だけに指定。これで名前や写真は取得されず、内部IDのみ要求します。
    const authUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${line_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=openid&state=${user_id}&bot_prompt=normal`
    
    return new Response(null, { status: 302, headers: { Location: authUrl } })
  }

  // --- B. LINEから戻ってきた後の処理 ---
  try {
    const redirect_uri = `https://nnugdjrhmvbyjyibdaog.supabase.co/functions/v1/line-auth`
    
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri,
        client_id: line_id!, client_secret: line_secret!
      }),
    })
    const tokenData = await tokenRes.json()
    const payload = JSON.parse(atob(tokenData.id_token.split('.')[1]))
    const line_user_id = payload.sub // 内部識別子(Uxxx...)

    const supabase = createClient(supabase_url!, supabase_service_role!)
    await supabase.from('profiles').update({ line_user_id: line_user_id }).eq('id', user_id)

    if (error) {
      if (error.code === '23505') return new Response("このLINEアカウントは既に連携済みです。", { status: 400 })
      throw error
    }

    // 成功したらNetlifyへ戻す
    return new Response(null, { status: 302, headers: { Location: NETLIFY_URL } })
    
  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 })
  }
})