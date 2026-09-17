const { chromium } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve('../beef-config/build');
  const server = http.createServer((req, res) => {
    const file = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({channel:'msedge', headless:true});
    const page = await browser.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('beef-language','ja');
      const bytes = new Uint8Array(1025); bytes[0]=1; bytes[1]=24; bytes[31]=2; bytes[79]=60; bytes[80]=1; bytes[81]=24; bytes[89]=100;
      for(let i=103;i<114;i++) bytes[i]=100;
      window.writes=[]; window.diagnosticReads=0;
      const device={productName:'BEEF BOARD',vendorId:0xfeed,productId:0,opened:true,open:async()=>{},close:async()=>{},
        receiveFeatureReport:async id=>{
          if(id===4){window.diagnosticReads++;const d=new Uint8Array(25);d[0]=4;d[1]=3;d[3]=2;d[6]=123;return new DataView(d.buffer);}
          return new DataView(bytes.buffer.slice(0));
        },
        sendFeatureReport:async(id,data)=>{window.writes.push({id,data:[...data]});if(id===1)bytes.set(data,1);}};
      Object.defineProperty(navigator,'hid',{value:{requestDevice:async()=>[device],getDevices:async()=>[device],addEventListener(){},removeEventListener(){}}});
      if(!navigator.usb)Object.defineProperty(navigator,'usb',{value:{}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button',{name:'接続 / Connect Device'}).click();
    await page.locator('input#tt-ratio').waitFor();
    await page.locator('input#tt-ratio').fill('3');
    await page.locator('input#button-led-fade').fill('150');
    await page.getByPlaceholder('プロファイル名').first().fill('Test');
    await page.getByRole('button',{name:'保存',exact:true}).first().click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('beef-board-profiles-v1')).Test);
    assert.equal(saved.tt_ratio,4);assert.equal(saved.button_led_fade_ms,150);assert.equal(saved.iidx_keys.main_buttons.length,7);
    await page.locator('input#button-led-fade').fill('0');
    await page.getByRole('button',{name:'読込',exact:true}).first().click();
    await page.waitForFunction(()=>document.querySelector('input#button-led-fade')?.value==='150');
    await page.getByRole('button',{name:'レインボー',exact:true}).click();
    await page.getByRole('button',{name:'暗め',exact:true}).click();
    assert.equal(await page.locator('input#button-led-brightness').inputValue(),'25');
    await page.getByRole('button',{name:'全消灯',exact:true}).click();
    await page.getByRole('button',{name:'青白',exact:true}).click();
    await page.getByRole('button',{name:'開始',exact:true}).click();
    await page.waitForFunction(()=>window.diagnosticReads>1);
    await page.getByRole('button',{name:'停止',exact:true}).click();
    const count=await page.evaluate(()=>window.diagnosticReads);
    await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.diagnosticReads),count);
    assert.deepEqual(errors,[]);
    console.log('PASS: profile snapshots/restoration, slider synchronization, LED presets, diagnostic start/stop; mock HID');
  } finally {if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
