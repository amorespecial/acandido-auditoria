export interface ConfigFieldItem {
  id: string;
  name: string;
  builtIn?: boolean;
  type?: string;
  required?: boolean;
  enabled?: boolean;
  options?: string[];
}

export const BUILTIN_GARANTIA_FIELDS: ConfigFieldItem[] = [
  { id: "fabricante", name: "Fabricante", builtIn: true },
  { id: "nfEmissionDate", name: "Nota Fiscal / Data de Emissão", builtIn: true },
  { id: "reference", name: "Referência", builtIn: true },
  { id: "pieceObservation", name: "Observação da Peça", builtIn: true },
  { id: "scrapObservation", name: "Observação da Sucata", builtIn: true }
];

export const BUILTIN_TOP10_FIELDS: ConfigFieldItem[] = [
  { id: "quantidade", name: "Quantidade Física Encontrada", builtIn: true },
  { id: "foto", name: "Anexar Foto de Evidência", builtIn: true }
];

export const BUILTIN_LAYOUT_FIELDS: ConfigFieldItem[] = [
  { id: "localizacao", name: "Localização Informada / Diretrizes Fotográficas", builtIn: true },
  { id: "fotos", name: "Anexar Fotos Estéticas (até 5)", builtIn: true },
  { id: "comentario", name: "Comentários / Observações do Almoxarife", builtIn: true }
];

export const BUILTIN_UNIMOBIN_FIELDS: ConfigFieldItem[] = [
  { id: "certificado", name: "Anexo de PDF / Imagem de Certificado", builtIn: true }
];

export function getOrderedFields(
  config: any,
  defaultBuiltInFields: ConfigFieldItem[]
): ConfigFieldItem[] {
  if (!config) return defaultBuiltInFields;

  const customFields: ConfigFieldItem[] = (config.customFields || []).map((cf: any) => ({
    ...cf,
    builtIn: false
  }));

  const allFields: ConfigFieldItem[] = [...defaultBuiltInFields, ...customFields];

  const fieldOrder: string[] = config.fieldOrder || [];

  if (!fieldOrder || fieldOrder.length === 0) {
    return allFields;
  }

  const orderedMap = new Map<string, ConfigFieldItem>();
  allFields.forEach((f) => orderedMap.set(f.id, f));

  const result: ConfigFieldItem[] = [];

  for (const id of fieldOrder) {
    if (orderedMap.has(id)) {
      result.push(orderedMap.get(id)!);
      orderedMap.delete(id);
    }
  }

  orderedMap.forEach((f) => result.push(f));

  return result;
}
