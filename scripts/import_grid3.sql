INSERT INTO geo.data_sources(id,title,publisher,source_url,license,verification_notes)
SELECT source_key, title, 'eHealth Africa and Proxy Logics / GRID3',
       'https://www.arcgis.com/home/item.html?id=' || item, 'CC BY 4.0',
       '2020 operational boundaries. Ekiti extract retrieved 2026-11-10. See data/grid3.'
FROM (VALUES
  ('grid3-state-2020','Nigeria Operational State Boundaries','c41532b720504f4799fe20438b7e3b7f'),
  ('grid3-lga-2020','Nigeria Operational Local Government Area Boundaries','2bb616a49ee84f409427cc2143787113')
) source(source_key,title,item) ON CONFLICT DO NOTHING;

SELECT geo.stage_boundary(area_key,source_key,feature,4326) FROM features;

-- Only the pinned, reviewed features qualify for promotion. Preserve manual
-- disputes and rejections and do not promote unrelated staging records.
UPDATE geo.areas a SET verification_state='verified',data_source_id=f.source_key
FROM features f WHERE a.id=f.area_key AND a.verification_state='unverified'
  AND a.data_source_id='ekiti-lga-name-audit';
UPDATE geo.boundaries b SET verification_state='verified'
FROM features f JOIN geo.areas a ON a.id=f.area_key
WHERE b.area_id=f.area_key AND b.data_source_id=f.source_key
  AND a.verification_state='verified' AND b.verification_state='unverified'
  AND extensions.ST_OrderingEquals(b.geom,extensions.ST_Multi(extensions.ST_GeomFromGeoJSON(f.feature->'geometry')));
