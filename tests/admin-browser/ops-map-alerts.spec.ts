import {test,expect} from '@playwright/test';

test('clean operations overview shows tailored alerts, 16 LGA selectors and clear source labels',async({page})=>{
  await page.goto('/?view=analytics');
  await expect(page.getByRole('heading',{name:'Workspace overview'})).toBeVisible();
  const alerts=page.getByRole('region',{name:'Sample alert inbox'});
  await expect(alerts.getByRole('heading',{name:/Needs attention/})).toBeVisible();
  await expect(alerts.getByText('Street lighting around a market')).toBeVisible();
  await expect(alerts.getByText('Public water point maintenance')).toBeVisible();
  await expect(alerts.getByLabel('Sound off')).toBeVisible();
  await expect(alerts.getByRole('button',{name:'Test chime'})).toBeDisabled();
  const map=page.getByRole('region',{name:'Ekiti LGA map and sample report counts'});
  await expect(map.getByText('DEMO DATA')).toBeVisible();
  await expect(map.getByRole('button',{name:/Show sample cases in/})).toHaveCount(16);
  await expect(map.getByText(/not incident coordinates, danger zones/i)).toBeVisible();
  await map.getByRole('button',{name:'Show sample cases in Ikere'}).click();
  await expect(page.getByRole('searchbox')).toHaveValue('Ikere');
  await expect(page.locator('.case-list-item')).toHaveCount(1);
  await expect(page.locator('.case-list-item').first()).toContainText('DEMO-1002');
});

test('sounds are silent by default and only triggered by an explicit test action',async({page})=>{
  await page.goto('/?view=analytics');
  let soundContexts=0;
  await page.evaluate(()=>{
    const Original=window.AudioContext;
    Object.defineProperty(window,'AudioContext',{
      configurable:true,
      value:class MockAudioContext{
        state='running';currentTime=0;destination={};
        constructor(){(window as unknown as {__audioConstructed?:number}).__audioConstructed=
          ((window as unknown as {__audioConstructed?:number}).__audioConstructed||0)+1;}
        createOscillator(){return {type:'sine',frequency:{value:0},connect:()=>{},start:()=>{},stop:()=>{}};}
        createGain(){return {gain:{setValueAtTime:()=>{},
          exponentialRampToValueAtTime:()=>{}},connect:()=>{}};}
        async resume(){}async close(){}
      },
    });
    void Original;
  });
  const alert=page.getByRole('region',{name:'Sample alert inbox'});
  expect(await page.evaluate(()=>(window as unknown as {__audioConstructed?:number}).__audioConstructed||0)).toBe(0);
  await alert.locator('#ops-sound').check();
  expect(await page.evaluate(()=>(window as unknown as {__audioConstructed?:number}).__audioConstructed||0)).toBe(0);
  await alert.getByRole('button',{name:'Test chime'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {__audioConstructed?:number}).__audioConstructed||0)).toBe(1);
  await alert.locator('#ops-sound').uncheck();
  await expect(alert.getByRole('button',{name:'Test chime'})).toBeDisabled();
  soundContexts=await page.evaluate(()=>(window as unknown as {__audioConstructed?:number}).__audioConstructed||0);
  expect(soundContexts).toBe(1);
});

test('overview, alerts and map remain usable without horizontal scrolling on 280px devices',async({page})=>{
  await page.setViewportSize({width:280,height:720});
  await page.goto('/?view=analytics');
  await expect(page.getByRole('heading',{name:'Ekiti, at a glance'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Show sample cases in Ado-Ekiti'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(281);
  await page.screenshot({path:'test-results/admin-review/clean-overview-280.png',fullPage:true});
});
