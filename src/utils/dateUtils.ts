// Utility functions for dynamic years and months across the system

export function getAnosDisponiveis(): number[] {
  const anoAtual = new Date().getFullYear();
  const anoInicio = 2026; // primeiro ano do sistema
  const anos: number[] = [];
  for (let ano = anoAtual; ano >= anoInicio; ano--) {
    anos.push(ano);
  }
  return anos.length > 0 ? anos : [anoInicio];
}

// Para filtros que precisam mostrar ano atual + próximo (ex: calendário de inventários):
export function getAnosCalendario(): number[] {
  const anoAtual = new Date().getFullYear();
  return [anoAtual + 1, anoAtual, anoAtual - 1].filter(a => a >= 2026);
}

// Para filtros de meses (ex: garantias ou histórico), gera automaticamente do mês atual retroativo
export function getMesesDisponiveis(): string[] {
  const meses: string[] = [];
  const nomeMeses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth(); // 0-11

  // Gerar últimos 18 meses a partir do mês atual
  for (let i = 0; i <= 17; i++) {
    const d = new Date(anoAtual, mesAtual - i, 1);
    const mIdx = d.getMonth();
    const a = d.getFullYear();
    if (a >= 2026) {
      meses.push(`${nomeMeses[mIdx]} ${a}`);
    }
  }
  return meses;
}
