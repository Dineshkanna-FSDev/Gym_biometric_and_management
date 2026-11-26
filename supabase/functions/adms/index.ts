import { withSupabase } from "npm:@supabase/server@1";

const DEVICE_SECRET = Deno.env.get("DEVICE_SECRET") || "";

const TEXT_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
};

export default {
  fetch: withSupabase({ auth: "none" }, async (req: Request, ctx) => {
    const supabase = ctx.supabaseAdmin;
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const sn = url.searchParams.get("SN") || "UNKNOWN";

    if (DEVICE_SECRET && url.searchParams.get("token") !== DEVICE_SECRET) {
      return new Response("Unauthorized", { status: 401, headers: TEXT_HEADERS });
    }

    try {
      // 1. DEVICE HANDSHAKE & CONFIG (GET /iclock/cdata)
      if (method === "GET" && path.endsWith("/iclock/cdata")) {
        const responseBody = [
          `GET OPTION FROM: ${sn}`,
          "ATTLOGStamp=None",
          "OPERLOGStamp=9999",
          "ATTPHOTOStamp=None",
          "ErrorDelay=30",
          "Delay=60",
          "TransTimes=00:00;14:05",
          "TransInterval=1",
          "TransFlag=1111111111",
          "TimeZone=330",
          "Realtime=1",
          "Encrypt=None",
        ].join("\r\n") + "\r\n";

        return new Response(responseBody, { status: 200, headers: TEXT_HEADERS });
      }

      // 2. INCOMING ATTENDANCE & USER/FACE SYNC (POST /iclock/cdata)
      if (method === "POST" && path.endsWith("/iclock/cdata")) {
        const table = (url.searchParams.get("table") || "").toUpperCase();
        const rawBody = await req.text();
        const lines = rawBody
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

        // A. Attendance Logs (Member Face Scan)
        if (table === "ATTLOG") {
          const punches = lines
            .map((line) => {
              const parts = line.split("\t");
              const pin = parseInt(parts[0], 10);
              const localTimestamp = parts[1];
              if (isNaN(pin) || !localTimestamp) return null;

              const isoTimestamp = `${localTimestamp.replace(" ", "T")}+05:30`;
              return { pin, isoTimestamp, epoch: Date.parse(isoTimestamp) };
            })
            .filter((p): p is NonNullable<typeof p> => p !== null && !isNaN(p.epoch))
            .sort((a, b) => a.epoch - b.epoch);

          for (const punch of punches) {
            const { error } = await supabase.rpc("process_biometric_punch", {
              p_device_pin: punch.pin,
              p_punched_at: punch.isoTimestamp,
            });
            if (error) console.error("Punch RPC error:", error);
          }

          return new Response(`OK: ${punches.length}`, {
            status: 200,
            headers: TEXT_HEADERS,
          });
        }

        // B. New User & Face Enrollment Sync from Device (OPERLOG / BIODATA / USERPIC)
        if (table === "OPERLOG" || table === "BIODATA" || table === "USERPIC") {
          const usersFromDevice = new Map<number, { name?: string; faceEnrolled: boolean }>();

          for (const line of lines) {
            const pinMatch = line.match(/(?:^|\s|\t)PIN=(\d+)/i);
            if (!pinMatch) continue;

            const pin = parseInt(pinMatch[1], 10);
            const existing = usersFromDevice.get(pin) || { faceEnrolled: false };

            // Extract Name from "USER PIN=1002\tName=Dinesh..."
            const nameMatch = line.match(/(?:^|\t)Name=([^\t\r\n]+)/i);
            if (nameMatch && nameMatch[1].trim()) {
              existing.name = nameMatch[1].trim();
            }

            // Mark face enrolled if biometric template, face record, or photo is sent
            if (
              table === "BIODATA" ||
              table === "USERPIC" ||
              /^(BIODATA|USERPIC|FACE)\b/i.test(line)
            ) {
              existing.faceEnrolled = true;
            }

            usersFromDevice.set(pin, existing);
          }

          for (const [pin, info] of usersFromDevice.entries()) {
            // Check if member already exists in DB
            const { data: member } = await supabase
              .from("members")
              .select("id, full_name, face_enrolled")
              .eq("device_pin", pin)
              .maybeSingle();

            if (!member) {
              // Insert new member created directly on the biometric device
              const { error: insertError } = await supabase.from("members").insert({
                device_pin: pin,
                full_name: info.name || `Member ${pin}`,
                phone: `PENDING-${pin}`,
                face_enrolled: info.faceEnrolled,
                status: "active",
              });
              if (insertError) console.error("Auto-insert member error:", insertError);
            } else {
              // Update name or face_enrolled status if changed (without overriding manual status)
              const updates: Record<string, unknown> = {};
              if (info.name && member.full_name.startsWith("Member ")) {
                updates.full_name = info.name;
              }
              if (info.faceEnrolled && !member.face_enrolled) {
                updates.face_enrolled = true;
              }
              if (Object.keys(updates).length > 0) {
                await supabase.from("members").update(updates).eq("id", member.id);
              }
            }
          }

          return new Response(`OK: ${usersFromDevice.size}`, {
            status: 200,
            headers: TEXT_HEADERS,
          });
        }

        return new Response("OK", { status: 200, headers: TEXT_HEADERS });
      }

      // 3. DELIVER PENDING COMMANDS TO TERMINAL (GET /iclock/getrequest)
      if (method === "GET" && path.endsWith("/iclock/getrequest")) {
        const { data: commands, error } = await supabase
          .from("device_commands")
          .select("id, command_text")
          .eq("status", "pending")
          .order("id", { ascending: true })
          .limit(10);

        if (error || !commands || commands.length === 0) {
          return new Response("OK", { status: 200, headers: TEXT_HEADERS });
        }

        const ids = commands.map((c) => c.id);
        await supabase
          .from("device_commands")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .in("id", ids);

        const payload =
          commands.map((c) => `C:${c.id}:${c.command_text}`).join("\r\n") + "\r\n";

        return new Response(payload, { status: 200, headers: TEXT_HEADERS });
      }

      // 4. COMMAND EXECUTION ACKNOWLEDGMENT (POST /iclock/devicecmd)
      if (method === "POST" && path.endsWith("/iclock/devicecmd")) {
        const rawBody = await req.text();
        const lines = rawBody
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        for (const line of lines) {
          const params = new URLSearchParams(line);
          const cmdId = Number(params.get("ID"));
          const returnCode = params.get("Return");

          if (!isNaN(cmdId)) {
            const isSuccess = returnCode === "0";
            await supabase
              .from("device_commands")
              .update({
                status: isSuccess ? "acked" : "failed",
                acked_at: new Date().toISOString(),
              })
              .eq("id", cmdId);
          }
        }

        return new Response("OK", { status: 200, headers: TEXT_HEADERS });
      }

      return new Response("Not Found", { status: 404, headers: TEXT_HEADERS });
    } catch (err) {
      console.error("ADMS Edge Function Error:", err);
      return new Response("Internal Error", { status: 500, headers: TEXT_HEADERS });
    }
  }),
};