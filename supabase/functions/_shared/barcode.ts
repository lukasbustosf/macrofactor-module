/**
 * Escáner de código de barras vía Open Food Facts (gratis, sin API key).
 * Módulo reutilizable para Next.js (API route) o Supabase Edge Function.
 *
 * Uso:
 *   const p = await lookupBarcode("8410122072018");
 *   // p => { name, kcal100g, protein100g, carbs100g, fat100g } | null
 */

export interface FoodProduct {
  barcode: string;
  name: string;
  kcal100g: number;
  protein100g: number;
  carbs100g: number;
  fat100g: number;
}

const ENDPOINT = "https://world.openfoodfacts.org/api/v2/product";

export async function lookupBarcode(
  barcode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FoodProduct | null> {
  const url = `${ENDPOINT}/${encodeURIComponent(barcode)}.json`;
  const res = await fetchImpl(url);
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  if (data.status !== 1 || !data.product) return null;

  const n = data.product.nutriments || {};
  const num = (v: any): number => {
    const x = parseFloat(v);
    return Number.isFinite(x) ? x : 0;
  };

  return {
    barcode,
    name: data.product.product_name || "Sin nombre",
    kcal100g: num(n["energy-kcal_100g"] ?? n["energy_100g"]),
    protein100g: num(n["proteins_100g"]),
    carbs100g: num(n["carbohydrates_100g"]),
    fat100g: num(n["fat_100g"]),
  };
}
