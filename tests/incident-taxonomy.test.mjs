import test from 'node:test';
import assert from 'node:assert/strict';
import {REPORT_CATEGORIES,readJourneyDraft} from '../src/app/report-journey-state.ts';
import {
  INCIDENT_TAXONOMY,taxonomyQuestion,taxonomyChoiceLabel,
  hasValidTaxonomyChoice,reviewSignal,possibleSameTabDraft,
} from '../src/app/incident-taxonomy.ts';

test('every report and feedback category has distinct bilingual follow-up choices',()=>{
  assert.deepEqual(Object.keys(INCIDENT_TAXONOMY).sort(),[...REPORT_CATEGORIES].sort());
  for(const category of REPORT_CATEGORIES){
    const spec=INCIDENT_TAXONOMY[category];
    assert.ok(taxonomyQuestion(category,'en').length>=15);
    assert.ok(taxonomyQuestion(category,'yo').length>=10);
    assert.ok(spec.choices.length>=3);
    assert.equal(new Set(spec.choices.map(x=>x.id)).size,spec.choices.length);
    for(const option of spec.choices){
      assert.ok(/^[a-z0-9_]+$/.test(option.id));
      assert.ok(option.label.en.length>4);
      assert.ok(option.label.yo.length>3);
      assert.equal(taxonomyChoiceLabel(category,option.id,'en'),option.label.en);
      assert.equal(hasValidTaxonomyChoice(category,option.id),true);
    }
    assert.equal(taxonomyChoiceLabel(category,'unverified_value','en'),null);
    assert.equal(hasValidTaxonomyChoice(category,'unverified_value'),false);
  }
});

test('safety flags are user-stated signals only, and ALL reports still need human assessment',()=>{
  assert.equal(reviewSignal('Emergency','unknown'),'immediate_safety_concern');
  assert.equal(reviewSignal('Emergency','no'),'immediate_safety_concern');
  assert.equal(reviewSignal('Water','yes'),'immediate_safety_concern');
  assert.equal(reviewSignal('Security','yes'),'immediate_safety_concern');
  assert.equal(reviewSignal('Roads','no'),'manual_review_required');
  assert.equal(reviewSignal('Health','unknown'),'manual_review_required');
  assert.equal(reviewSignal('Commendation','no'),'manual_review_required');
});

test('local possible repeat requires SAME purpose, category, LGA and specific textual overlap',()=>{
  const saved={purpose:'report',category:'Roads',lgaId:'ado-ekiti',
    description:'Potholes beside the central market have damaged road surfaces for weeks'};
  const near={...saved,
    description:'Road surfaces beside the central market have potholes for several weeks'};
  assert.equal(possibleSameTabDraft(near,saved),true);
  assert.equal(possibleSameTabDraft({...near,lgaId:'ikere'},saved),false);
  assert.equal(possibleSameTabDraft({...near,category:'Water'},saved),false);
  assert.equal(possibleSameTabDraft({...near,purpose:'feedback'},saved),false);
  assert.equal(possibleSameTabDraft({...near,description:'bad street'},saved),false);
  assert.equal(possibleSameTabDraft(near,null),false);
  assert.equal(possibleSameTabDraft({...saved,description:'the road is bad'},saved),false);
});

test('Sprint 03 opt-in structured answers survive short-lived same-tab restore without media/contact',()=>{
  const now=Date.parse('2026-11-11T02:00:00.000Z');
  const draft={
    purpose:'report',method:'Text',category:'Electricity',description:'Exposed wires are hanging close to the street.',
    lgaId:'ado-ekiti',community:'Near market',subcategory:'hazard',immediateDanger:'yes',
    savedAt:new Date(now-4000).toISOString(),
    media:'data:image/png;base64,secret',contact:'private@example.test',location:{lat:7.7,lon:5.2},
  };
  const safe=readJourneyDraft(JSON.stringify(draft),'report',['ado-ekiti'],now);
  assert.equal(safe?.subcategory,'hazard');
  assert.equal(safe?.immediateDanger,'yes');
  assert.ok(!JSON.stringify(safe).includes('secret'));
  assert.ok(!JSON.stringify(safe).includes('private@example.test'));
  assert.ok(!JSON.stringify(safe).includes('lat'));
  assert.equal(readJourneyDraft(JSON.stringify({...draft,subcategory:'invalid'}),'report',['ado-ekiti'],now),null);
  assert.equal(readJourneyDraft(JSON.stringify({...draft,immediateDanger:'critical'}),'report',['ado-ekiti'],now),null);
  assert.equal(readJourneyDraft(JSON.stringify({...draft,category:'Water'}),'report',['ado-ekiti'],now),null);
  const old={...draft};
  delete old.subcategory;delete old.immediateDanger;
  const previous=readJourneyDraft(JSON.stringify(old),'report',['ado-ekiti'],now);
  assert.ok(previous);
  assert.equal(Object.hasOwn(previous,'subcategory'),false);
  assert.equal(Object.hasOwn(previous,'immediateDanger'),false);
});
