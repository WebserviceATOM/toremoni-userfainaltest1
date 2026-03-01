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
  
  // ★ここをあなたのNetlifyのURL（末尾に / なし）に書き換えてください！
  const NETLIFY_URL = "https://toremoni-testsite-fromgithub.netlify.app"; 

  // --- 1. LINEのログイン画面へ飛ばす処理 ---
  if (!code) {
    if (!user_id) return new Response("Error: ユーザーIDが見つかりません", { status: 400 })
    const redirect_uri = `https://nnugdjrhmvbyjyibdaog.supabase.co/functions/v1/line-auth`
    
    // 内部ID(openid)のみを要求
    const authUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${line_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&scope=openid&state=${user_id}&bot_prompt=normal`
    return new Response(null, { status: 302, headers: { Location: authUrl } })
  }

  // --- 2. LINEから戻ってきた後の処理 ---
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
    
    // IDトークンから内部識別子を解析
    const payload = JSON.parse(atob(tokenData.id_token.split('.')[1]))
    const line_user_id = payload.sub 

    // Supabaseに管理者権限で接続して保存
    const supabase = createClient(supabase_url!, supabase_service_role!)
    const { error: dbError } = await supabase.from('profiles').update({ line_user_id: line_user_id }).eq('id', user_id)

    if (dbError) {
      if (dbError.code === '23505') return new Response("このLINEは既に他のアカウントと連携済みです", { status: 400 })
      throw dbError
    }

    // 【成功】Netlifyのマイページへ自動リダイレクト
    return new Response(null, { status: 302, headers: { Location: NETLIFY_URL } })
    
  } catch (e) {
    // 変数名を e に統一して「not defined」エラーを回避
    return new Response("連携エラー: " + (e instanceof Error ? e.message : "不明なエラー"), { status: 500 })
  }
})
