/** Require an explicit server acknowledgement before reporting an accounting action as done. */
export async function confirmedRpc(client, name, payload) {
  const { data, error } = await client.rpc(name, payload)
  if (error) throw error
  if (data?.success !== true) {
    throw new Error(data?.error || data?.message || 'Сервер не підтвердив операцію. Оновіть дані та перевірте її стан.')
  }
  return data
}
