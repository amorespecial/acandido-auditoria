import { supabase } from "./supabaseClient";

async function testColumn(colName: string, value: any) {
  const { error } = await supabase
    .from('avaliacoes')
    .insert({
      almoxarifado: 'FRETAMENTO GOIANA',
      mes: 1,
      ano: 2026,
      criterio_codigo: '2',
      criterio_nome: 'TOP 10',
      [colName]: value
    });
  if (error && error.message.includes("schema cache")) {
    return false;
  } else {
    console.log(`FOUND COLUMN IN avaliacoes: '${colName}' (Error or Success: ${error?.message})`);
    return true;
  }
}

async function run() {
  console.log("Probing columns for avaliacoes...");
  const colNames = [
    "quantidades",
    "quantidade",
    "qtd",
    "top10_almoxarife_quantities",
    "top10_auditor_quantities",
    "top10_almoxarife",
    "top10_auditor",
    "qtd_almoxarife",
    "qtd_auditor",
    "itens",
    "lista_itens",
    "audit_mode",
    "modo_auditoria"
  ];
  for (const name of colNames) {
    await testColumn(name, [1, 2, 3]);
  }
}

run();
