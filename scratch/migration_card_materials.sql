-- Add card_id to material_requests referencing work_cards (UUID type)
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES work_cards(id) ON DELETE CASCADE;

-- Add pocket_owner text column to inventory and reception_docs
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS pocket_owner text;
ALTER TABLE reception_docs ADD COLUMN IF NOT EXISTS pocket_owner text;

