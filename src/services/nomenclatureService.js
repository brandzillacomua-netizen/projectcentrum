const API_URL = '/api/nomenclature';

export const nomenclatureService = {
  // Groups
  async getGroups() {
    const res = await fetch(`${API_URL}/groups`);
    if (!res.ok) throw new Error('Failed to fetch groups');
    return res.json();
  },

  async createGroup(data) {
    const res = await fetch(`${API_URL}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create group');
    return res.json();
  },

  // Types
  async getTypes() {
    const res = await fetch(`${API_URL}/types`);
    if (!res.ok) throw new Error('Failed to fetch types');
    return res.json();
  },

  async createType(data) {
    const res = await fetch(`${API_URL}/types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create type');
    return res.json();
  },

  async deleteType(id) {
    const res = await fetch(`${API_URL}/types/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete type');
    return true;
  },

  // Nomenclature
  async getNomenclature() {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Failed to fetch nomenclature');
    return res.json();
  },

  async createNomenclature(data) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create nomenclature');
    return res.json();
  },

  async searchNomenclature(query) {
    const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async getDetails(id) {
    const res = await fetch(`${API_URL}/${id}`);
    if (!res.ok) throw new Error('Failed to fetch details');
    return res.json();
  },

  async deleteNomenclature(id) {
    const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete item');
    return true;
  },

  async deactivate(id) {
    const res = await fetch(`${API_URL}/${id}/deactivate`, { method: 'PATCH' });
    if (!res.ok) throw new Error('Failed to deactivate');
    return res.json();
  },

  async activate(id) {
    const res = await fetch(`${API_URL}/${id}/activate`, { method: 'PATCH' });
    if (!res.ok) throw new Error('Failed to activate');
    return res.json();
  }
};
