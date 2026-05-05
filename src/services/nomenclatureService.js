const API_URL = '/api/nomenclature';

const getHeaders = () => {
  const token = localStorage.getItem('BACKEND_TOKEN');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

export const nomenclatureService = {
  // Groups
  async getGroups() {
    const res = await fetch(`${API_URL}/groups`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch groups');
    return res.json();
  },

  async createGroup(data) {
    const res = await fetch(`${API_URL}/groups`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create group');
    return res.json();
  },

  // Types
  async getTypes() {
    const res = await fetch(`${API_URL}/types`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch types');
    return res.json();
  },

  async createType(data) {
    const res = await fetch(`${API_URL}/types`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create type');
    return res.json();
  },

  async deleteType(id) {
    const res = await fetch(`${API_URL}/types/${id}`, { 
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete type');
    return true;
  },

  // Nomenclature
  async getNomenclature() {
    const res = await fetch(API_URL, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch nomenclature');
    return res.json();
  },

  async createNomenclature(data) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to create nomenclature: ${res.status} ${errText}`);
    }
    return res.json();
  },

  async searchNomenclature(query) {
    const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async getDetails(id) {
    const res = await fetch(`${API_URL}/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch details');
    return res.json();
  },

  async deleteNomenclature(id) {
    const res = await fetch(`${API_URL}/${id}`, { 
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete item');
    return true;
  },

  async deactivate(id) {
    const res = await fetch(`${API_URL}/${id}/deactivate`, { 
      method: 'PATCH',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to deactivate');
    return res.json();
  },

  async activate(id) {
    const res = await fetch(`${API_URL}/${id}/activate`, { 
      method: 'PATCH',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to activate');
    return res.json();
  },

  // Characteristics
  async getCharacteristics(baseId) {
    const res = await fetch(`${API_URL}/${baseId}/characteristics`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch characteristics');
    return res.json();
  },

  async createCharacteristic(baseId, data) {
    const res = await fetch(`${API_URL}/${baseId}/characteristics`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create characteristic');
    return res.json();
  },

  async upsertAttribute(charId, data) {
    const res = await fetch(`/api/characteristics/${charId}/attributes`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to upsert attribute');
    return res.json();
  },

  // Counterparties
  async getCounterparties() {
    const res = await fetch('/api/counterparties', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch counterparties');
    return res.json();
  },

  async createCounterparty(data) {
    const res = await fetch('/api/counterparties', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create counterparty');
    return res.json();
  }
};
