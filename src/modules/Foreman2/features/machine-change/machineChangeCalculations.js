import { asId, asNumber } from '../../utils/normalize.js'
import { getCardSheets } from '../shortage/shortageCalculations.js'

export const calculateMachineChangeImpact = ({ task, part, cards = [], targetMachine }) => {
  const partCards = cards.filter(card => asId(card.task_id) === asId(task?.id) && asId(card.nomenclature_id) === asId(part?.nomId))
  const alreadyCutSheets = partCards.reduce((sum, card) => sum + getCardSheets(card, part?.unitsPerSheet), 0)
  const plannedSheets = asNumber(part?.plannedSheets)
  const remainingSheets = Math.max(0, plannedSheets - alreadyCutSheets)

  return {
    taskId: asId(task?.id),
    nomId: asId(part?.nomId),
    fromMachine: part?.machine || task?.machine_name || '',
    toMachine: targetMachine || '',
    alreadyCutSheets,
    plannedSheets,
    remainingSheets,
    canChange: remainingSheets > 0
  }
}
