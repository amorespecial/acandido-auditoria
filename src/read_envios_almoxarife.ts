import { supabase } from "./supabaseClient";

async function run() {
  console.log("Reading envios_almoxarife comments...");
  try {
    const { data, error } = await supabase
      .from("envios_almoxarife")
      .select("id, almoxarifado, mes, ano, criterio_codigo, comentario");
    if (error) {
      console.error("Error:", error);
    } else {
      console.log("envios_almoxarife rows count:", data?.length);
      data?.forEach((row: any) => {
        console.log(`Branch: ${row.almoxarifado}, Month: ${row.mes}, Year: ${row.ano}, Criterio: ${row.criterio_codigo}`);
        console.log(`Comment: "${row.comentario}"`);
        console.log("---");
      });
    }
  } catch (e) {
    console.error("Catch:", e);
  }
}

run();
