// Supabase Edge Function: send-push
// Deno runtime
//
// Отримує { user_id, title, body, path, notifData }
// Дістає всі push підписки юзера з БД
// Надсилає web push через web-push-neo (aes128gcm)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNotification } from "npm:web-push-neo@0.1.2";

// ─── VAPID Configuration ──────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = "BKuq-VKlrw9HR3MIZu307Hqd0U_LHkJxVMbgNBfC6je6OjVoU3IcDe5mdynIy95cJXtfv9viv3PnQW6DS4vbeOM";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = "mailto:admin@centrum.app";

// ─── CORS Headers ─────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, path, notifData } = await req.json();

    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Supabase client з service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Отримуємо всі підписки цього юзера
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = { title, body, path: path || "/", tag: String(Date.now()), notifData };
    const results = [];
    const toDelete = [];

    const vapidDetails = {
      subject: VAPID_SUBJECT,
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY,
    };

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      };

      try {
        const res = await sendNotification(pushSubscription, JSON.stringify(payload), {
          vapidDetails,
          TTL: 86400
        });
        results.push({ ok: true, status: res.statusCode || 201 });
      } catch (err: any) {
        console.error("sendNotification failed for endpoint:", sub.endpoint, err);
        const status = err.statusCode || 500;
        results.push({ ok: false, status });

        // 410 Gone або 404 = підписка недійсна, видаляємо
        if (status === 410 || status === 404) {
          toDelete.push(sub.endpoint);
        }
      }
    }

    // Видаляємо протерміновані підписки
    if (toDelete.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", toDelete);
    }

    const sent = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ sent, total: subscriptions.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
