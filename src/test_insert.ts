import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  console.log("Testing basic field insertion...");
  try {
    const payload: any = {
      nome: "Test Basic User",
      email: "test_basic_user@example.com",
      perfil: "almoxarife",
      almoxarifado: "Unidade Teste",
      ativo: true
    };

    const { data, error } = await supabase.from('usuarios').insert(payload).select();
    if (error) {
       console.log(`❌ Basic insertion FAILED:`, error.message);
    } else {
       console.log(`✅ Basic insertion SUCCEEDED! Returned row keys and values:`, data?.[0]);
       // clean up
       await supabase.from('usuarios').delete().eq('email', payload.email);
    }
  } catch (err: any) {
    console.log(`❌ Basic insertion EXCEPTION:`, err.message);
  }
}

testInsert();
