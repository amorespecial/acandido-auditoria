import { supabase } from "./supabaseClient";

async function testColumn(colName: string, value: any) {
  const { error } = await supabase
    .from('top10_envios')
    .insert({
      almoxarifado: 'ALMOXARIFADO CAMPINA GRANDE',
      mes: 1,
      ano: 2026,
      [colName]: value
    });
  if (error && error.message.includes("schema cache")) {
    return false;
  } else {
    console.log(`FOUND COLUMN: '${colName}' (Error or Success: ${error?.message})`);
    return true;
  }
}

async function run() {
  console.log("Probing columns for top10_envios quantities...");
  const colNames = [
    "quantidades",
    "quantidade",
    "qtd",
    "itens",
    "itens_contados",
    "valores",
    "dados",
    "json",
    "info",
    "contagem",
    "contagens",
    "lista",
    "pecas",
    "materiais",
    "num_pecas",
    "auditor_qtd",
    "almoxarife_qtd",
    "qtd_alm",
    "qtd_aud",
    "status",
    "observacoes",
    "obs",
    "id",
    "created_at"
  ];
  for (const name of colNames) {
    await testColumn(name, [1, 2, 3]);
  }
}

run();
