import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTables() {
  const tables = [
    { name: 'ciclos', payload: { mes: 12, ano: 2026, status: 'fechado', iniciado_em: new Date().toISOString() } },
    { name: 'garantias', payload: { almoxarifado: 'TEST_AM', item_id: 'Test', status_garantia: 'Pendente', registrado_em: new Date().toISOString() } },
    { name: 'nivel_servico', payload: { almoxarifado: 'TEST_AM', mes: 'Janeiro', ano: '2026', nota: 100, registrado_em: new Date().toISOString() } },
    { name: 'layout_configuracao', payload: { almoxarifado: 'TEST_AM', mes: 'Janeiro', ano: '2026', localizacao: 'A1', atualizado_em: new Date().toISOString() } },
    { name: 'colaboradores_unimobin', payload: { nome: 'TEST_COLAB', cargo: 'TEST_CARGO', ativo: true } }
  ];

  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t.name).insert(t.payload).select();
      if (error) {
        console.log(`❌ Table [${t.name}] insert FAILED:`, error.message);
      } else {
        console.log(`✅ Table [${t.name}] insert SUCCEEDED!`);
        // Clean up
        if (t.name === 'colaboradores_unimobin') {
          await supabase.from(t.name).delete().eq('nome', 'TEST_COLAB');
        } else if (t.name === 'layout_configuracao') {
          await supabase.from(t.name).delete().eq('almoxarifado', 'TEST_AM');
        } else if (t.name === 'nivel_servico') {
          await supabase.from(t.name).delete().eq('almoxarifado', 'TEST_AM');
        } else if (t.name === 'garantias') {
          await supabase.from(t.name).delete().eq('almoxarifado', 'TEST_AM');
        } else if (t.name === 'ciclos') {
          await supabase.from(t.name).delete().eq('mes', 12).eq('ano', 2026);
        }
      }
    } catch (err: any) {
      console.log(`❌ Table [${t.name}] EXCEPTION:`, err.message);
    }
  }
}

testTables();
