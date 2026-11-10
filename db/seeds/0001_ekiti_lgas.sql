-- Names only, provisional audit input. Validate with official Ekiti registry.
-- Deliberately NO ward or coordinate/polygon seed: avoid made-up GIS assignments.
BEGIN;
INSERT INTO geo.data_sources(id,title,publisher,verification_notes)
VALUES ('ekiti-lga-name-audit','Provisional LGA name checklist','Project maintainer','Name checklist only. Must verify against official Ekiti SIEC before marking areas verified.')
ON CONFLICT (id) DO NOTHING;
INSERT INTO geo.areas(id,area_kind,name,parent_id,data_source_id)
VALUES ('ekiti','state','Ekiti',NULL,'ekiti-lga-name-audit')
ON CONFLICT (id) DO NOTHING;
INSERT INTO geo.areas(id,area_kind,name,parent_id,data_source_id)
VALUES
('ado-ekiti','lga','Ado-Ekiti','ekiti','ekiti-lga-name-audit'),
('efon','lga','Efon','ekiti','ekiti-lga-name-audit'),
('ekiti-east','lga','Ekiti East','ekiti','ekiti-lga-name-audit'),
('ekiti-south-west','lga','Ekiti South-West','ekiti','ekiti-lga-name-audit'),
('ekiti-west','lga','Ekiti West','ekiti','ekiti-lga-name-audit'),
('emure','lga','Emure','ekiti','ekiti-lga-name-audit'),
('gbonyin','lga','Gbonyin','ekiti','ekiti-lga-name-audit'),
('ido-osi','lga','Ido/Osi','ekiti','ekiti-lga-name-audit'),
('ijero','lga','Ijero','ekiti','ekiti-lga-name-audit'),
('ikere','lga','Ikere','ekiti','ekiti-lga-name-audit'),
('ikole','lga','Ikole','ekiti','ekiti-lga-name-audit'),
('ilejemeje','lga','Ilejemeje','ekiti','ekiti-lga-name-audit'),
('irepodun-ifelodun','lga','Irepodun/Ifelodun','ekiti','ekiti-lga-name-audit'),
('ise-orun','lga','Ise/Orun','ekiti','ekiti-lga-name-audit'),
('moba','lga','Moba','ekiti','ekiti-lga-name-audit'),
('oye','lga','Oye','ekiti','ekiti-lga-name-audit')
ON CONFLICT (id) DO NOTHING;
COMMIT;
