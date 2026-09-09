// A calculation contract, NOT a server authorization boundary.
// Existing warehouse_conf is text; partial approval does not satisfy the target contract.
export function assertGenerationApproved(task) {
  if (!task || ![true, 'true'].includes(task.warehouse_conf) ||
      task.engineer_conf !== true || task.director_conf !== true) {
    throw new Error('All three full approvals are required');
  }
}
