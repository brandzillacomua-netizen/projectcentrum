import React, { useState, useMemo } from 'react'
import { Search, Filter, Phone, Mail, Award, Eye, Plus, ChevronRight, Crown, Trash2 } from 'lucide-react'
import { useMES } from '../../../MESContext'
import { DeleteClientModal } from './DeleteClientModal'

export const ClientsList = ({ clients = [], onOpenClientDetail, onDeleteClient, onOpenCreateModal }) => {
  const { currentUser } = useMES()
  const isAdmin = currentUser?.login === 'admin@workshop.local' || currentUser?.role === 'admin' || currentUser?.role === 'director' || (currentUser?.position || '').toLowerCase().includes('адмін')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSegment, setSelectedSegment] = useState('all') // 'all', 'VIP', 'Regular'
  const [sortBy, setSortBy] = useState('revenue') // 'revenue', 'avgCheck', 'ordersCount', 'name'
  const [deletingClient, setDeletingClient] = useState(null)

  // Filter & Sort Clients
  const filteredClients = useMemo(() => {
    return clients
      .filter(cli => {
        const matchesSearch = (cli.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (cli.contactPerson || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (cli.phone || '').includes(searchQuery) ||
                              (cli.email || '').toLowerCase().includes(searchQuery.toLowerCase())
        const matchesSegment = selectedSegment === 'all' || cli.segment === selectedSegment
        return matchesSearch && matchesSegment
      })
      .sort((a, b) => {
        if (sortBy === 'revenue') return b.totalRevenue - a.totalRevenue
        if (sortBy === 'avgCheck') return b.avgCheck - a.avgCheck
        if (sortBy === 'ordersCount') return b.ordersCount - a.ordersCount
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        return 0
      })
  }, [clients, searchQuery, selectedSegment, sortBy])

  return (
    <div className="glass-panel" style={{ borderRadius: '20px', padding: '16px' }}>
      {/* Search & Action Controls Header */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '20px',
        width: '100%'
      }}>
        {/* Row 1: Search Bar & Create Button */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          width: '100%'
        }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Пошук клієнта за назвою, телефоном, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 40px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'rgba(0,0,0,0.2)',
                color: 'var(--text)',
                fontSize: '0.85rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            onClick={onOpenCreateModal}
            style={{
              padding: '9px 16px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              fontWeight: 950,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Plus size={16} /> Новий Клієнт
          </button>
        </div>

        {/* Row 2: Filter Pills & Sort Selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexWrap: 'wrap',
          width: '100%'
        }}>
          {/* Segment Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', maxWidth: '100%', paddingBottom: '2px' }}>
            {['all', 'VIP', 'Regular'].map(seg => (
              <button
                key={seg}
                onClick={() => setSelectedSegment(seg)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: selectedSegment === seg ? '1px solid #6366f1' : '1px solid transparent',
                  background: selectedSegment === seg ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.04)',
                  color: selectedSegment === seg ? '#6366f1' : 'var(--text-muted)',
                  fontWeight: 850,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {seg === 'all' ? 'Всі Клієнти' : seg === 'VIP' ? '👑 VIP' : 'Постійні'}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid var(--glass-border)',
              background: 'rgba(0,0,0,0.2)',
              color: 'var(--text)',
              fontSize: '0.78rem',
              fontWeight: 800,
              outline: 'none',
              cursor: 'pointer',
              flex: '1 1 160px',
              maxWidth: '100%'
            }}
          >
            <option value="revenue" style={{ background: '#1c1c24' }}>Сортувати за Валом (₴)</option>
            <option value="avgCheck" style={{ background: '#1c1c24' }}>Сортувати за Середнім Чеком (₴)</option>
            <option value="ordersCount" style={{ background: '#1c1c24' }}>Сортувати за Кількістю Замовлень</option>
            <option value="name" style={{ background: '#1c1c24' }}>За Алфавітом</option>
          </select>
        </div>
      </div>

      {/* Clients Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px' }}>Замовник / Компанія</th>
              <th style={{ padding: '12px' }}>Контактні Дані</th>
              <th style={{ padding: '12px' }}>Замовлення</th>
              <th style={{ padding: '12px' }}>Середній Чек (₴)</th>
              <th style={{ padding: '12px' }}>Загальний LTV (₴)</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Дії</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Жодного клієнта не знайдено за вашим запитом.
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const isVip = client.segment === 'VIP'
                return (
                  <tr
                    key={client.id}
                    onClick={() => onOpenClientDetail(client)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Client Name */}
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: isVip ? 'linear-gradient(135deg, #ec4899, #be185d)' : 'rgba(99, 102, 241, 0.2)',
                          color: isVip ? '#fff' : '#6366f1',
                          fontWeight: 950,
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {client.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {client.name}
                            {isVip && <Crown size={14} color="#ec4899" />}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {client.contactPerson}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contacts */}
                    <td style={{ padding: '14px 12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <div>{client.phone}</div>
                      <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>{client.email}</div>
                    </td>

                    {/* Orders Count */}
                    <td style={{ padding: '14px 12px', fontWeight: 800 }}>
                      <span style={{ padding: '4px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', fontSize: '0.8rem' }}>
                        {client.ordersCount} шт
                      </span>
                    </td>

                    {/* Avg Check */}
                    <td style={{ padding: '14px 12px', fontWeight: 900, color: '#ff9000' }}>
                      {client.avgCheck > 0 ? `₴${client.avgCheck.toLocaleString()}` : '—'}
                    </td>

                    {/* Total LTV */}
                    <td style={{ padding: '14px 12px', fontWeight: 950, color: '#10b981' }}>
                      {client.totalRevenue > 0 ? `₴${client.totalRevenue.toLocaleString()}` : '₴0'}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '14px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenClientDetail(client); }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: '#6366f1',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          Картка Клієнта <ChevronRight size={14} />
                        </button>

                        {isAdmin && onDeleteClient && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletingClient(client)
                            }}
                            title="Видалити клієнта з бази"
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <DeleteClientModal
        isOpen={!!deletingClient}
        clientName={deletingClient?.name}
        onConfirm={() => {
          if (deletingClient) {
            onDeleteClient(deletingClient.id, deletingClient.name)
            setDeletingClient(null)
          }
        }}
        onCancel={() => setDeletingClient(null)}
      />
    </div>
  )
}
