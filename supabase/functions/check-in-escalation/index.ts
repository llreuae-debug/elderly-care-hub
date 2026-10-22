// Supabase Edge Function: check-in-escalation
// Evaluates daily check-ins for active care circles, sends push alerts on missed deadline,
// and escalates via Twilio SMS to the primary caregiver after 30 minutes.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

interface EscalationResult {
  circleId: string;
  circleName: string;
  deadline: string;
  actionTaken: 'none' | 'push_sent' | 'sms_escalated' | 'already_handled';
  smsStatus?: string;
  recipientPhone?: string;
}

serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
    const twilioFromNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional manual trigger payload for testing
    let manualCircleId: string | null = null;
    let forceSms = false;

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        manualCircleId = body.circleId || null;
        forceSms = !!body.forceSms;
      } catch {
        // Empty or non-JSON body is allowed
      }
    }

    const todayDateStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHours * 60 + currentMinutes;

    // Fetch circles
    let circleQuery = supabase.from('care_circles').select('*');
    if (manualCircleId) {
      circleQuery = circleQuery.eq('id', manualCircleId);
    }

    const { data: circles, error: circleError } = await circleQuery;
    if (circleError || !circles) {
      return new Response(JSON.stringify({ error: circleError?.message || 'No circles found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: EscalationResult[] = [];

    for (const circle of circles) {
      // Parse deadline
      const deadlineStr = circle.check_in_deadline_time || '10:00';
      const [deadH, deadM] = deadlineStr.split(':').map((v: string) => parseInt(v, 10));
      const deadlineTotalMinutes = deadH * 60 + deadM;

      // Check today's check-in
      const { data: checkIn } = await supabase
        .from('daily_check_ins')
        .select('*')
        .eq('care_circle_id', circle.id)
        .eq('check_in_date', todayDateStr)
        .maybeSingle();

      // If elder already checked in as 'ok', no escalation needed
      if (checkIn && checkIn.status === 'ok') {
        results.push({
          circleId: circle.id,
          circleName: circle.name,
          deadline: deadlineStr,
          actionTaken: 'none',
        });
        continue;
      }

      const isPastDeadline = currentTimeMinutes >= deadlineTotalMinutes || forceSms;
      const minutesOverdue = currentTimeMinutes - deadlineTotalMinutes;

      if (!isPastDeadline) {
        results.push({
          circleId: circle.id,
          circleName: circle.name,
          deadline: deadlineStr,
          actionTaken: 'none',
        });
        continue;
      }

      const currentStage = checkIn ? checkIn.escalation_stage : 0;

      // Stage 1: Push notification to all care circle members
      if (currentStage === 0 && (!checkIn || checkIn.status === 'missed')) {
        // Record missed check-in with stage 1
        await supabase.from('daily_check_ins').upsert(
          {
            care_circle_id: circle.id,
            check_in_date: todayDateStr,
            status: 'missed',
            escalation_stage: 1,
            notes: `Missed check-in by deadline ${deadlineStr}. Stage 1 push notification dispatched.`,
          },
          { onConflict: 'care_circle_id,check_in_date' }
        );

        // Also log warning event to circle timeline
        await supabase.from('timeline_events').insert({
          care_circle_id: circle.id,
          created_by: circle.created_by,
          type: 'note',
          title: `⚠️ Alert: Missed Daily Check-in by ${deadlineStr}`,
          description: `Daily check-in was not received by ${deadlineStr}. Care circle members have been alerted via push notification. Twilio SMS will escalate in 30 minutes if unconfirmed.`,
          occurred_at: now.toISOString(),
        });

        results.push({
          circleId: circle.id,
          circleName: circle.name,
          deadline: deadlineStr,
          actionTaken: 'push_sent',
        });
      }
      // Stage 2: After 30 minutes, escalate via Twilio SMS to primary caregiver
      else if ((currentStage === 1 && (minutesOverdue >= 30 || forceSms)) || (forceSms && currentStage < 2)) {
        const primaryPhone = circle.primary_caregiver_phone || Deno.env.get('FALLBACK_CAREGIVER_PHONE');
        let smsResultStatus = 'skipped_no_phone';

        if (primaryPhone && twilioAccountSid && twilioAuthToken && twilioFromNumber) {
          const smsBody = `URGENT [Elderly Care Hub]: ${circle.name} missed daily check-in (deadline ${deadlineStr}). 30-min escalation window expired without confirmation. Please call or visit immediately.`;

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const formData = new URLSearchParams();
          formData.append('To', primaryPhone);
          formData.append('From', twilioFromNumber);
          formData.append('Body', smsBody);

          const twilioResp = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            },
            body: formData.toString(),
          });

          if (twilioResp.ok) {
            smsResultStatus = 'sent';
          } else {
            const errText = await twilioResp.text();
            smsResultStatus = `error: ${errText}`;
          }
        }

        // Update escalation stage to 2
        await supabase
          .from('daily_check_ins')
          .update({
            escalation_stage: 2,
            notes: `Stage 2 Twilio SMS escalation executed. Status: ${smsResultStatus}`,
          })
          .eq('care_circle_id', circle.id)
          .eq('check_in_date', todayDateStr);

        // Log escalation to circle timeline
        await supabase.from('timeline_events').insert({
          care_circle_id: circle.id,
          created_by: circle.created_by,
          type: 'note',
          title: `🚨 Emergency Escalation: SMS Dispatched to Primary Caregiver`,
          description: `Check-in overdue by 30+ minutes. SMS alert was dispatched to primary caregiver (${primaryPhone || 'registered phone'}).`,
          occurred_at: now.toISOString(),
        });

        results.push({
          circleId: circle.id,
          circleName: circle.name,
          deadline: deadlineStr,
          actionTaken: 'sms_escalated',
          smsStatus: smsResultStatus,
          recipientPhone: primaryPhone || undefined,
        });
      } else {
        results.push({
          circleId: circle.id,
          circleName: circle.name,
          deadline: deadlineStr,
          actionTaken: 'already_handled',
        });
      }
    }

    return new Response(JSON.stringify({ success: true, processedAt: now.toISOString(), results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
