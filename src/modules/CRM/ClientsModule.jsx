import React, { useState } from 'react'
import { Users, Plus, ShieldCheck, TrendingUp } from 'lucide-react'
import { useClientsData } from './hooks/useClientsData'
import { ClientMetricsSummary } from './components/ClientMetricsSummary'
import { ClientsList } from './components/ClientsList'
import { ClientDetailPage } from './components/ClientDetailPage'
import { CreateClientModal } from './components/CreateClientModal'

const ClientsModule = () => {
  const {
    clients,
    summaryMetrics,
    addClient,
    updateClient,
    deleteClient,
    addCommunication,
    getClientCommunications
  } = useClientsData()

  const [selectedClientId, setSelectedClientId] = useState(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Find active selected client object from state or dummy new client
  const selectedClient = selectedClientId === 'new'
    ? { id: 'new', name: '', contactPerson: '', phone: '', email: '', tin: '', city: 'Київ', address: '', manager: 'Олександр Менеджер', segment: 'Regular', notes: '' }
    : clients.find(c => c.id === selectedClientId)

  const handleOpenDetail = (client) => {
    setSelectedClientId(client.id)
  }

  const handleBackToList = () => {
    setSelectedClientId(null)
  }

  const handleCreateClient = (newClientData) => {
    const created = addClient(newClientData)
    setSelectedClientId(created.id)
  }

  const handleUpdateClient = (clientId, updatedFields) => {
    updateClient(clientId, updatedFields)
  }

  const handleDeleteClient = (clientId, clientName) => {
    deleteClient(clientId, clientName)
    if (selectedClientId === clientId) {
      setSelectedClientId(null)
    }
  }

  const handleAddCommunication = (newComm) => {
    addCommunication(newComm)
  }

  const activeCommunications = (selectedClient && selectedClient.id !== 'new') ? getClientCommunications(selectedClient.id) : []

  return (
    <div style={{ padding: '14px', width: '100%', boxSizing: 'border-box' }}>
      {selectedClient ? (
        /* Full Page Client Card View */
        <ClientDetailPage
          client={selectedClient}
          onBack={handleBackToList}
          onUpdateClient={handleUpdateClient}
          onDeleteClient={handleDeleteClient}
          onCreateClient={handleCreateClient}
          communications={activeCommunications}
          onAddCommunication={handleAddCommunication}
        />
      ) : (
        /* Main Clients Database List View */
        <>
          {/* Top Header */}
          <div className="crm-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px',
            paddingLeft: '65px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 6px 18px rgba(99, 102, 241, 0.35)'
                }}>
                  <Users size={22} />
                </div>
                <div>
                  <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 950, letterSpacing: '-0.4px', color: 'var(--text)' }}>
                    База Клієнтів CRM
                  </h1>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Аналітика середнього чека, історія замовлень, LTV та картки клієнтів
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Summary Metrics Strip */}
          <ClientMetricsSummary summaryMetrics={summaryMetrics} />

          {/* Main Clients Table & List */}
          <ClientsList
            clients={clients}
            onOpenClientDetail={handleOpenDetail}
            onDeleteClient={handleDeleteClient}
            onOpenCreateModal={() => setSelectedClientId('new')}
          />
        </>
      )}
    </div>
  )
}

export default ClientsModule
