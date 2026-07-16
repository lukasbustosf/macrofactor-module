import { lookupBarcode, FoodProduct } from "../supabase/functions/_shared/barcode.ts";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("  ✗ FAIL:", msg);
  } else {
    console.log("  ✓", msg);
  }
}

// Mock de fetch para Open Food Facts
function mockFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return (async () => {
    return {
      ok,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

console.log("== Test barcode: producto encontrado ==");
const fake = {
  status: 1,
  product: {
    product_name: "Fideos integales",
    nutriments: {
      "energy-kcal_100g": 350,
      proteins_100g: 12,
      carbohydrates_100g: 70,
      fat_100g: 3,
    },
  },
};
const p: FoodProduct | null = await lookupBarcode(
  "8410122072018",
  mockFetch(fake) as any,
);
assert(p !== null, "producto no es null");
assert(p?.name === "Fideos integales", `nombre mapeado (got ${p?.name})`);
assert(p?.kcal100g === 350, `kcal100g = 350 (got ${p?.kcal100g})`);
assert(p?.protein100g === 12, `proteinas = 12 (got ${p?.protein100g})`);
assert(p?.carbs100g === 70, `carbos = 70 (got ${p?.carbs100g})`);
assert(p?.fat100g === 3, `grasas = 3 (got ${p?.fat100g})`);

console.log("== Test barcode: no encontrado (status 0) ==");
const none = await lookupBarcode("000000", mockFetch({ status: 0 }) as any);
assert(none === null, "retorna null si status != 1");

if (failures > 0) {
  console.error(`\n${failures} test(s) fallaron`);
  process.exit(1);
} else {
  console.log("\nTodos los tests de barcode pasaron ✓");
}
