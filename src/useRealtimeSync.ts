import { useEffect } from "react";
import { supabase, isSupabaseReady, realtimeFlags } from "./supabaseClient";

export interface RealtimePayload {
  table: string;
  eventType: string;
  new: any;
  old: any;
}

export function useRealtimeSync(
  onUpdate?: (payload: RealtimePayload) => void,
  deps: any[] = []
) {
  useEffect(() => {
    if (!isSupabaseReady()) {
      console.warn("[Realtime Global Sync] Supabase is not ready, skipping sync connection.");
      return;
    }

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channel = supabase.channel(`global-sync-${uniqueId}`);

    const tables = [
      "audit_modes",
      "ciclos",
      "avaliacoes",
      "unimobin_certificados",
      "colaboradores_unimobin",
      "calendario_inventarios",
      "garantias",
      "materiais_parados",
      "historico_avaliacoes",
      "nivel_servico",
      "top10_config",
      "top10_envios",
      "envios_almoxarife",
      "usuarios"
    ];

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload: any) => {
          console.log(`[Realtime Global Sync] DB change on: ${table}`, payload);
          
          if (realtimeFlags.isLocalUpdate) {
            console.log(`[Realtime Global Sync] Ignoring self-update change on: ${table}`);
            return;
          }

          // Define local mapping of tables to standard custom event names
          const eventMap: Record<string, string> = {
            audit_modes: "realtime-audit-modes-update",
            ciclos: "realtime-ciclos-update",
            avaliacoes: "realtime-avaliacoes-update",
            unimobin_certificados: "realtime-unimobin-certificados-update",
            colaboradores_unimobin: "realtime-unimobin-certificados-update",
            calendario_inventarios: "realtime-calendario-update",
            garantias: "realtime-garantias-update",
            materiais_parados: "realtime-material-sem-mov-update",
            historico_avaliacoes: "realtime-historico-update",
            nivel_servico: "realtime-nivel-servico-update",
            top10_config: "realtime-top10-config-update",
            top10_envios: "realtime-top10-envios-update",
            envios_almoxarife: "realtime-envios-almoxarife-update",
            usuarios: "realtime-usuarios-update"
          };

          const eventName = eventMap[table];
          if (eventName) {
            window.dispatchEvent(new Event(eventName));
          }

          // Dispatch a generic global custom event
          const customEvent = new CustomEvent("realtime-global-update", {
            detail: {
              table,
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old
            }
          });
          window.dispatchEvent(customEvent);

          if (onUpdate) {
            onUpdate({
              table,
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old
            });
          }
        }
      );
    });

    channel.subscribe((status: string) => {
      console.log(`[Realtime Global Sync] Channel status is: ${status}`);
    });

    return () => {
      console.log(`[Realtime Global Sync] Demounting, removing channel global-sync-${uniqueId}`);
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.error("[Realtime Global Sync] Error removing channel:", err);
      }
    };
  }, deps);
}
