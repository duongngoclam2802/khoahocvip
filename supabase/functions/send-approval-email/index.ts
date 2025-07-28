// File: supabase/functions/send-approval-email/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

// Lấy các key bí mật từ Environment Variables
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const ADMIN_SERVICE_KEY = Deno.env.get('ADMIN_SERVICE_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

const resend = new Resend(RESEND_API_KEY)

serve(async (req) => {
  // Xử lý CORS để trình duyệt có thể gọi function
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }
  
  try {
    const { emails, mailContent } = await req.json()
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      throw new Error("Danh sách email không hợp lệ hoặc rỗng.");
    }

    // Khởi tạo admin client để có quyền UPDATE, bỏ qua RLS
    const supabaseAdminClient = createClient(
      SUPABASE_URL ?? '',
      ADMIN_SERVICE_KEY ?? ''
    )

    // 1. Cập nhật trạng thái trong DB bằng quyền admin
    const { data: updatedUsers, error: updateError } = await supabaseAdminClient
      .from('trial_users')
      .update({ status: 'đã duyệt', approved_at: new Date().toISOString() })
      .in('email', emails)
      .select('email')

    if (updateError) throw updateError
    
    const successfulEmails = updatedUsers.map(u => u.email);

    // 2. Gửi email đến các địa chỉ đã được cập nhật thành công
    for (const email of successfulEmails) {
      await resend.emails.send({
        from: 'Hoc Thu <hocthu@resend.dev>', // Thay bằng email của bạn đã xác thực trên Resend
        to: email,
        subject: 'Thông báo duyệt học thử thành công!',
        html: mailContent.replace(/\n/g, '<br>')
      });
    }
    
    return new Response(
      JSON.stringify({ successCount: successfulEmails.length }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    )
  } catch (error) {
    console.error('Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})