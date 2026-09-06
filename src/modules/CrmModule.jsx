import React from 'react'
import { useCrmData } from './CRM/hooks/useCrmData.js'
import CrmHeader from './CRM/components/CrmHeader.jsx'
import CrmControlBar from './CRM/components/CrmControlBar.jsx'
import CrmBoard from './CRM/components/CrmBoard.jsx'
import CrmLeadModal from './CRM/components/modals/CrmLeadModal.jsx'
import CrmStageModal from './CRM/components/modals/CrmStageModal.jsx'

export default function CrmModule() {
  const crm = useCrmData()

  return (
    <div className="crm-module-container" style={{ padding: '14px', minHeight: '100vh', background: 'transparent', color: 'var(--text)', boxSizing: 'border-box', width: '100%' }}>
      {/* Top Header */}
      <CrmHeader
        totalPipelineValue={crm.totalPipelineValue}
        leadsCount={crm.leads.length}
      />

      {/* Control Bar */}
      <CrmControlBar
        selectedStageFilter={crm.selectedStageFilter}
        setSelectedStageFilter={crm.setSelectedStageFilter}
        leads={crm.leads}
        stages={crm.stages}
        searchQuery={crm.searchQuery}
        setSearchQuery={crm.setSearchQuery}
        openStageModalForCreate={crm.openStageModalForCreate}
        openLeadModalForCreate={crm.openLeadModalForCreate}
      />

      {/* Dynamic Kanban Pipeline Columns */}
      <CrmBoard
        stages={crm.stages}
        filteredLeads={crm.filteredLeads}
        handleMoveColumn={crm.handleMoveColumn}
        openStageModalForEdit={crm.openStageModalForEdit}
        handleDeleteStage={crm.handleDeleteStage}
        openLeadModalForEdit={crm.openLeadModalForEdit}
        handleDeleteLead={crm.handleDeleteLead}
        handleMoveLeadStage={crm.handleMoveLeadStage}
      />

      {/* Modal: Create / Edit Lead */}
      <CrmLeadModal
        isAddLeadOpen={crm.isAddLeadOpen}
        setIsAddLeadOpen={crm.setIsAddLeadOpen}
        editingLead={crm.editingLead}
        leadForm={crm.leadForm}
        setLeadForm={crm.setLeadForm}
        stages={crm.stages}
        handleSaveLead={crm.handleSaveLead}
      />

      {/* Modal: Create / Edit Stage */}
      <CrmStageModal
        isAddStageOpen={crm.isAddStageOpen}
        setIsAddStageOpen={crm.setIsAddStageOpen}
        editingStage={crm.editingStage}
        stageForm={crm.stageForm}
        setStageForm={crm.setStageForm}
        handleSaveStage={crm.handleSaveStage}
      />
    </div>
  )
}
