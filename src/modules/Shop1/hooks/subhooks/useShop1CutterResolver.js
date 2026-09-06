import { useCallback } from 'react';
import { isMachineMatch } from '../../../../utils/cutterCalculator';

export function useShop1CutterResolver({
  nomenclatures,
  tasks,
  inventory,
  machineOperations,
  requests
}) {
  const isGenericCutterName = useCallback((name) => {
    if (!name) return true;
    const clean = String(name).trim().toLowerCase();
    if (clean === 'фреза') return true;
    if (/^фреза\s+ф\d+/i.test(clean)) return true;
    const nom = nomenclatures?.find(n => n.name.trim().toLowerCase() === clean);
    if (nom && nom.type === 'cutter_type') return true;
    return false;
  }, [nomenclatures]);

  const resolveCutterName = useCallback((cutterNom, partSelectedCutters) => {
    if (!cutterNom) return null;
    const genericName = cutterNom.name.trim();

    if (cutterNom.type === 'consumable' && !isGenericCutterName(genericName)) {
      return genericName;
    }

    if (partSelectedCutters && typeof partSelectedCutters === 'object') {
      const invId = partSelectedCutters[genericName]
        || partSelectedCutters[genericName.toLowerCase()]
        || partSelectedCutters[String(cutterNom.id)];
      
      if (invId) {
        const inv = (inventory || []).find(i => String(i.id) === String(invId));
        if (inv) {
          const nom = nomenclatures?.find(n => String(n.id) === String(inv.nomenclature_id));
          if (nom && !isGenericCutterName(nom.name)) return nom.name.trim();
          if (inv.name && !isGenericCutterName(inv.name)) return inv.name.trim();
        }
        const nom = nomenclatures?.find(n => String(n.id) === String(invId));
        if (nom && !isGenericCutterName(nom.name)) return nom.name.trim();
      }
    }

    const matchingConsumable = nomenclatures?.find(n =>
      n.type === 'consumable' &&
      String(n.characteristic) === String(cutterNom.id) &&
      !isGenericCutterName(n.name)
    );
    if (matchingConsumable) {
      return matchingConsumable.name.trim();
    }

    return null;
  }, [inventory, nomenclatures, isGenericCutterName]);

  const getCuttersForCard = useCallback((card) => {
    if (!card) return [];
    const task = tasks?.find(t => String(t.id) === String(card.task_id));
    const targetMachine = task?.machine_name || card.machine || '';
    const cardNomId = String(card.nomenclature_id || '');
    const configuredCutters = [];

    const addCutter = (name) => {
      if (!name) return;
      const cleanName = String(name).trim();
      if (cleanName && !isGenericCutterName(cleanName) && !configuredCutters.includes(cleanName)) {
        configuredCutters.push(cleanName);
      }
    };

    const partSelectedCutters = task?.plan_snapshot?.[cardNomId]?.selected_cutters 
      || task?.plan_snapshot?.selectedCutters;

    const allOpsForCardNom = (machineOperations || []).filter(o => String(o.nomenclature_id) === cardNomId);
    let cardOpData = null;
    if (targetMachine) {
      cardOpData = allOpsForCardNom.find(o =>
        isMachineMatch(o.machine_type, targetMachine) ||
        isMachineMatch(o.machine_id, targetMachine)
      );
    }
    if (!cardOpData && allOpsForCardNom.length > 0) {
      cardOpData = allOpsForCardNom[0];
    }
    if (cardOpData && cardOpData.side2_cut_ops) {
      const cutterOps = cardOpData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'));
      cutterOps.forEach(op => {
        const parts = op.split(':');
        const cutterNomId = parts[1];
        if (cutterNomId) {
          const cutterNom = nomenclatures?.find(n => String(n.id) === String(cutterNomId));
          if (cutterNom) {
            const resolved = resolveCutterName(cutterNom, partSelectedCutters);
            if (resolved) addCutter(resolved);
          }
        }
      });
    }

    if (configuredCutters.length === 0 && partSelectedCutters && typeof partSelectedCutters === 'object') {
      Object.values(partSelectedCutters).forEach(invId => {
        if (invId) {
          const inv = (inventory || []).find(i => String(i.id) === String(invId));
          if (inv) {
            const nom = nomenclatures?.find(n => String(n.id) === String(inv.nomenclature_id));
            const name = nom ? nom.name : inv.name;
            if (name && name.toLowerCase().includes('фреза')) {
              addCutter(name);
            }
          } else {
            const nom = nomenclatures?.find(n => String(n.id) === String(invId));
            if (nom && nom.name && nom.name.toLowerCase().includes('фреза')) {
              addCutter(nom.name);
            }
          }
        }
      });
    }

    if (configuredCutters.length === 0 && requests && requests.length > 0) {
      const cardTaskReqs = requests.filter(r => 
        (r.card_id && String(r.card_id) === String(card.id)) ||
        (r.task_id && String(r.task_id) === String(card.task_id) && String(r.nomenclature_id) === cardNomId)
      );
      cardTaskReqs.forEach(r => {
        if (r.nomenclature_id) {
          const nom = nomenclatures?.find(n => String(n.id) === String(r.nomenclature_id));
          if (nom && nom.name && nom.name.toLowerCase().includes('фреза')) {
            addCutter(nom.name);
          }
        } else if (r.details && r.details.toLowerCase().includes('фреза')) {
          const match = r.details.match(/фреза[^\d]*\d+[\d\s.,xхXХx×]*/i);
          if (match) addCutter(match[0]);
        }
      });
    }

    return configuredCutters;
  }, [tasks, nomenclatures, inventory, machineOperations, requests, isGenericCutterName, resolveCutterName]);

  return {
    getCuttersForCard,
    isGenericCutterName,
    resolveCutterName
  };
}
