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
          "TransFlag=1111000000",
          "TimeZone=330",
          "Realtime=1",
          "Encrypt=None",
        ].join("\r\n") + "\r\n";

        return new Response(responseBody, { status: 200, headers: TEXT_HEADERS });
      }

      // 2. INCOMING ATTENDANCE & FACE ENROLLMENT LOGS (POST /iclock/cdata)
      if (method === "POST" && path.endsWith("/iclock/cdata")) {
        const table = (url.searchParams.get("table") || "").toUpperCase();
        const rawBody = await req.text();
        const lines = rawBody
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);

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

        if (table === "OPERLOG" || table === "BIODATA" || table === "USERPIC") {
          const enrolledPins = new Set<number>();

          for (const line of lines) {
            const pinMatch = line.match(/(?:^|\s|\t)PIN=(\d+)/i);
            if (pinMatch) {
              if (
                table === "BIODATA" ||
                table === "USERPIC" ||
                line.startsWith("BIODATA") ||
                line.startsWith("USERPIC") ||
                line.startsWith("OPLOG")
              ) {
                enrolledPins.add(parseInt(pinMatch[1], 10));
              }
            }
          }

          for (const pin of enrolledPins) {
            const { error } = await supabase.rpc("confirm_face_enrolled", {
              p_device_pin: pin,
            });
            if (error) console.error("Confirm face RPC error:", error);
          }

          return new Response(`OK: ${enrolledPins.size}`, {
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