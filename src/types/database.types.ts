/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ MES CENTRUM ENTERPRISE: DATABASE & DOMAIN TYPESCRIPT DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface SystemAccessLog {
  id: number
  created_at: string
  user_id: number | null
  user_login: string
  user_name?: string | null
  action_type: string
  category: 'auth' | 'access' | 'security' | 'system'
  ip_address?: string | null
  details?: string | null
  status: 'success' | 'warning' | 'error'
}

export interface SecurityEventPayload {
  p_user_login: string
  p_action_type: string
  p_category?: string
  p_ip_address?: string
  p_details?: string
  p_status?: string
}

export interface WorkCard {
  id: string
  card_number: string
  status: 'pending' | 'in-progress' | 'completed' | 'quality_hold' | 'scrapped'
  operation: string
  operator_name?: string | null
  nomenclature_id?: string | null
  quantity: number
  created_at: string
  updated_at: string
}

export interface Nomenclature {
  id: string
  name: string
  code?: string | null
  type: 'raw' | 'semi_shop1' | 'semi_shop2' | 'finished' | 'consumable' | 'hardware'
  unit?: string | null
  group_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface InventoryItem {
  id: string
  nomenclature_id?: string | null
  name: string
  type: string
  warehouse: 'operational' | 'production' | 'fgp' | 'buffer'
  pocket_owner?: string | null
  unit: string
  total_qty: number
  reserved_qty: number
  updated_at: string
}

export interface SystemUser {
  id: number
  login: string
  first_name?: string | null
  last_name?: string | null
  role: string
  department?: string | null
  position?: string | null
  shift?: string | null
  access_rights?: Record<string, boolean>
}
