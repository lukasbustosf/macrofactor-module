export interface Macro {
  kcal: number;
  proteina: number;
  carbohidrato: number;
  grasa: number;
}

/** Busca un alimento por barcode en Open Food Facts (gratis, sin key). */
export async function lookupBarcode(
  barcode: string,
): Promise<{ nombre: string; porcion_g: number; macros: Macro } | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
    );
    const json = await res.json();
    if (json.status !== 1) return null;
    const p = json.product;
    const per100 = p.nutriments ?? {};
    const kcal = Number(per100["energy-kcal_100g"] ?? per100["energy_100g"] ?? 0) || 0;
    const macros: Macro = {
      kcal,
      proteina: Number(per100["proteins_100g"] ?? 0) || 0,
      carbohidrato: Number(per100["carbohydrates_100g"] ?? 0) || 0,
      grasa: Number(per100["fat_100g"] ?? 0) || 0,
    };
    const nombre = p.product_name_es || p.product_name || `Barcode ${barcode}`;
    return { nombre, porcion_g: 100, macros };
  } catch {
    return null;
  }
}

/** Escala macros de "por 100g" a la cantidad ingerida. */
export function scaleMacros(m: Macro, gramos: number): Macro {
  const f = gramos / 100;
  return {
    kcal: Math.round(m.kcal * f),
    proteina: Math.round(m.proteina * f * 10) / 10,
    carbohidrato: Math.round(m.carbohidrato * f * 10) / 10,
    grasa: Math.round(m.grasa * f * 10) / 10,
  };
}

export const TIPOS_COMIDA = [
  "desayuno",
  "almuerzo",
  "once",
  "cena",
  "snack",
] as const;
export type TipoComida = (typeof TIPOS_COMIDA)[number];

export const TIPO_LABEL: Record<TipoComida, string> = {
  desayuno: "🍳 Desayuno",
  almuerzo: "🥘 Almuerzo",
  once: "☕ Once",
  cena: "🌙 Cena",
  snack: "🍎 Snack",
};
