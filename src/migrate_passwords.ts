import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import "dotenv/config";

// Official credentials fallback list to match with legacy configuration
const OFFICIAL_CREDENTIALS = [
  { email: "estoque01jp@gmail.com", password: "33911386Fe@" },
  { email: "estoquejp@acandidotransportes.com.br", password: "Nathalia1" },
  { email: "almoxarifadojp@acandidotransportes.com.br", password: "almoxarifadojp" },
  { email: "robson.almoxarife@acandidogrupo.com.br", password: "Robson@Almox2026" },
  { email: "muniz.jabo@acandidotransportes.com.br", password: "jaboatão@2026" },
  { email: "glebson.jabo@acandidotransportes.com.br", password: "jab#2026" },
  { email: "comprascg@acandidotransportes.com.br", password: "almoxarifadocg" },
  { email: "almoxarifadogo@transnacionalfretamento.com.br", password: "almoxarifadogo" },
  { email: "almoxarifadope01@transnacionalfretamento.com.br", password: "fretamentope" },
  { email: "almoxarifadorn@acandidotransportes.com.br", password: "almoxarifadorn" },
  { email: "ti02rn@acandidotransportes.com.br", password: "almoxarifado02" },
  { email: "fretamentojoaopessoa@gmail.com", password: "fretamentojp@" },
  { email: "almoxarifadobayeux@rodoviarionordestino.com.br", password: "almoxarifadorodo" },
  { email: "almoxarifadoce@transnacionalfretamento.com.br", password: "fretamentoce" }
];

async function runMigration() {
  console.log("=========================================");
  console.log("INICIANDO MIGRAÇÃO DE SENHAS (FASE 3)");
  console.log("=========================================");

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Erro: Credenciais do Supabase não encontradas no ambiente.");
    console.error("Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas.");
    process.exit(1);
  }

  console.log(`Conectando ao Supabase: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Fetch all users from database
  const { data: users, error } = await supabase.from("usuarios").select("*");

  if (error) {
    console.error("Erro ao buscar usuários do Supabase:", error);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log("Nenhum usuário encontrado na tabela 'usuarios'.");
    process.exit(0);
  }

  let totalFound = users.length;
  let migratedCount = 0;
  let ignoredCount = 0;
  let errorCount = 0;
  const migrationErrors: string[] = [];

  console.log(`Encontrados ${totalFound} usuários. Verificando senhas...`);

  for (const u of users) {
    const email = u.email ? u.email.toLowerCase().trim() : "";
    const nome = u.nome || "Sem Nome";

    // Check if the user already has a valid bcrypt password hash
    const hasHash = u.senha_hash && (
      u.senha_hash.startsWith("$2a$") || 
      u.senha_hash.startsWith("$2b$") || 
      u.senha_hash.startsWith("$2y$")
    );

    if (hasHash) {
      console.log(`[-] Ignorado: ${nome} (${email}) - Já possui senha_hash.`);
      ignoredCount++;
      continue;
    }

    // Attempt to recover legacy plain password
    let plainPassword = "";

    // A. Parse from 'almoxarifado' JSON column
    if (u.almoxarifado && typeof u.almoxarifado === "string" && u.almoxarifado.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(u.almoxarifado);
        plainPassword = parsed.password || "";
      } catch (e) {
        // Safe to ignore, fallback to other options
      }
    }

    // B. Check official credentials fallback list
    if (!plainPassword) {
      const official = OFFICIAL_CREDENTIALS.find(o => o.email.toLowerCase().trim() === email);
      if (official) {
        plainPassword = official.password;
      }
    }

    // C. Default fallback if nothing else is found
    if (!plainPassword) {
      plainPassword = "123456";
    }

    try {
      // Generate bcrypt hash
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(plainPassword, salt);

      // Save only the 'senha_hash' column to preserve other existing fields perfectly
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({ senha_hash: hash })
        .eq("id", u.id);

      if (updateError) {
        throw updateError;
      }

      console.log(`[+] Migrado: ${nome} (${email}) com sucesso.`);
      migratedCount++;
    } catch (err: any) {
      console.error(`[x] Erro ao migrar ${nome} (${email}):`, err.message || err);
      errorCount++;
      migrationErrors.push(`${email}: ${err.message || JSON.stringify(err)}`);
    }
  }

  // 3. Print Report
  console.log("\n=========================================");
  console.log("RELATÓRIO DA MIGRAÇÃO");
  console.log("=========================================");
  console.log(`Total de usuários encontrados : ${totalFound}`);
  console.log(`Total migrados com sucesso    : ${migratedCount}`);
  console.log(`Total ignorados (já com hash) : ${ignoredCount}`);
  console.log(`Total de falhas / erros       : ${errorCount}`);
  
  if (migrationErrors.length > 0) {
    const isColumnMissing = migrationErrors.some(err => err.includes("senha_hash"));
    if (isColumnMissing) {
      console.log("\n⚠️ DETECTADO: A coluna 'senha_hash' não foi criada ou não está visível no Supabase.");
      console.log("Para resolver isso, acesse o SQL Editor do seu painel do Supabase e execute:");
      console.log("\n------------------------------------------------");
      console.log("ALTER TABLE usuarios ADD COLUMN senha_hash TEXT;");
      console.log("------------------------------------------------\n");
      console.log("Depois de rodar o comando acima, execute novamente esta migração!");
    }

    console.log("\nDetalhes dos erros ocorridos:");
    migrationErrors.forEach(err => console.log(`- ${err}`));
  }
  console.log("=========================================\n");
}

runMigration().catch(err => {
  console.error("Erro fatal na execução da migração:", err);
  process.exit(1);
});
