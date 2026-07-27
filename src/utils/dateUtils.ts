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

export interface MesOpcao {
  label: string;
  value: string;
  mes: number;
  ano: number;
}

// Gerar lista de meses dinamicamente
export const gerarMesesDisponiveis = (): MesOpcao[] => {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth(); // 0-11
  const ANO_MINIMO = 2026;
  
  const opcoes: MesOpcao[] = [];
  
  // Mostrar do mês atual para trás até Janeiro de 2026 (limite mínimo do sistema é 2026)
  for (let ano = anoAtual; ano >= ANO_MINIMO; ano--) {
    const mesInicio = ano === anoAtual ? mesAtual : 11;
    const mesFim = 0; // Janeiro
    
    for (let mes = mesInicio; mes >= mesFim; mes--) {
      opcoes.push({
        label: `${meses[mes]} ${ano}`,
        value: `${meses[mes]} ${ano}`,
        mes: mes + 1,
        ano: ano
      });
    }
  }
  
  return opcoes;
};

// Para filtros de meses (ex: garantias ou histórico), gera automaticamente do mês atual retroativo
export function getMesesDisponiveis(): string[] {
  return gerarMesesDisponiveis().map(op => op.value);
}
