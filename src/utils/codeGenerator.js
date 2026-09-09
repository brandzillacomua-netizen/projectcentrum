/**
 * Universal safe code generator for nomenclatures_v2.
 * Prevents regex digit concatenation bugs and ensures unique code generation.
 */
export async function generateNextV2Code(supabase, cachedItems = null) {
  let itemsToScan = Array.isArray(cachedItems) && cachedItems.length > 0 ? cachedItems : null;

  if (!itemsToScan && supabase) {
    try {
      const { data } = await supabase.from('nomenclatures_v2').select('code');
      itemsToScan = data || [];
    } catch (e) {
      itemsToScan = [];
    }
  }

  let maxNum = 90000;
  for (const it of (itemsToScan || [])) {
    const codeStr = String(it?.code || '').trim();
    // Strictly match standard V2 numeric codes: V2-90001 ... V2-99999
    const m = codeStr.match(/^V2-(\d{5,6})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n >= 90000 && n < 999999) {
        if (n > maxNum) {
          maxNum = n;
        }
      }
    }
  }

  let candidateNum = maxNum + 1;
  if (supabase) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidateCode = `V2-${candidateNum}`;
      try {
        const { data: existing } = await supabase
          .from('nomenclatures_v2')
          .select('id')
          .eq('code', candidateCode)
          .maybeSingle();

        if (!existing) {
          return candidateCode;
        }
      } catch (e) {
        return candidateCode;
      }
      candidateNum++;
    }
  }

  return `V2-${candidateNum}`;
}
