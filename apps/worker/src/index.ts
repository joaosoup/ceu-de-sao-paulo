import { handleApi } from "./api.js";
import { decideUpcoming, dispatchDue } from "./decide.js";
import type { Env, PrecomputeTask, SendTask } from "./env.js";
import { refreshAndEnqueue, runPrecomputeTask } from "./precompute.js";
import { runSendTask } from "./send.js";

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(req, env, Date.now());
      } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: { "content-type": "application/json" } });
      }
    }
    return env.ASSETS.fetch(req);
  },

  async scheduled(controller, env): Promise<void> {
    const now = Date.now();
    if (controller.cron === "* * * * *") {
      await decideUpcoming(env, now);
      await dispatchDue(env, now);
    } else {
      console.log(await refreshAndEnqueue(env, now));
    }
  },

  async queue(batch, env): Promise<void> {
    const now = Date.now();
    for (const msg of batch.messages) {
      const body = msg.body as PrecomputeTask | SendTask;
      if (body.t === "send") await runSendTask(env, body, now);
      else await runPrecomputeTask(env, body, now);
      msg.ack();
    }
  },
} satisfies ExportedHandler<Env, PrecomputeTask | SendTask>;
