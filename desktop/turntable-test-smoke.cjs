const { chromium } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve('../beef-config/build');
  const server = http.createServer((req,res) => {
    const requestPath=req.url.split('?')[0];
    const entry=fs.existsSync(path.join(root,'index.html'))?'index.html':'404.html';
    const file=path.join(root,requestPath==='/'?entry:requestPath);
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:980,height:740}});page.setDefaultTimeout(10000);
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      localStorage.setItem('beef-language','ja');
      const bytes=new Uint8Array(1025);bytes[0]=1;bytes[1]=27;bytes[5]=1;bytes[31]=2;bytes[79]=60;bytes[81]=24;bytes[85]=1;bytes[89]=100;
      window.testRaw=0;window.sensorAB=0;window.reads=0;window.writes=[];window.failNextDiag=false;
      const device={productName:'BEEF BOARD',vendorId:0xfeed,productId:0,opened:true,collections:[{usagePage:0xffeb,usage:0x01}],close:async()=>{},
        receiveFeatureReport:async id=>{
          if(id===4){window.reads++;if(window.failNextDiag){window.failNextDiag=false;throw new DOMException('Busy','InvalidStateError');}const d=new Uint8Array(window.ttFrame ? 145 : window.barFrame ? 73 : 25);d[0]=4;d[3]=window.sensorAB;d[4]=99;d[6]=window.testRaw;if(window.barFrame)d.set(window.barFrame,25);if(window.ttFrame)d.set(window.ttFrame,73);return new DataView(d.buffer);}
          return new DataView(bytes.buffer.slice(0));
        },sendFeatureReport:async(id,data)=>window.writes.push({id,data:[...data]})};
      Object.defineProperty(navigator,'hid',{value:{requestDevice:async()=>[device],getDevices:async()=>[device],addEventListener(){},removeEventListener(){}}});
      if(!navigator.usb)Object.defineProperty(navigator,'usb',{value:{}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button',{name:'接続',exact:true}).click();
    const meter=page.getByRole('meter');
    const help=page.getByRole('button',{name:'ターンテーブル保持時間（ms）の説明',exact:true});
    await help.hover();
    await page.locator('[data-slot="tooltip-content"]').waitFor({state:'visible'});
    await page.mouse.move(1200,600,{steps:10});
    await page.locator('[data-slot="tooltip-content"]').waitFor({state:'hidden'});
    for(const value of [0,128,255,0]){
      await page.evaluate(v=>window.testRaw=v,value);
      await page.waitForFunction(v=>document.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')===String(v),value);
    }
    assert.equal(await meter.getAttribute('aria-valuemax'),'255');
    for (const [sensorAB, expected] of [[0,'0/0'],[1,'0/1'],[3,'1/1'],[2,'1/0']]) {
      await page.evaluate(v=>window.sensorAB=v,sensorAB);
      await page.waitForFunction(v=>document.querySelector('[data-testid="turntable-phases"]')?.textContent?.replace(/\s+/g,' ').trim().endsWith(v),expected);
    }
    assert.equal(await page.getByText('回転方向',{exact:true}).count(),0);

    assert.equal(await page.getByText('設定プロファイル',{exact:true}).count(),0);
    assert.equal(await page.getByText('ターンテーブル入力カーブ',{exact:true}).count(),0);
    assert.equal(await page.getByText('ボタンごとに設定',{exact:true}).count(),0);
    await page.getByRole('button',{name:/^キー割り当て/}).click();
    await page.getByRole('button',{name:'キーを初期化',exact:true}).click();
    await page.getByRole('alertdialog').getByRole('button',{name:'初期化',exact:true}).click();
    await page.getByRole('alertdialog').waitFor({state:'hidden'});
    await page.waitForFunction(()=>window.writes.some(x=>x.id===1&&x.data[35]===22));
    await page.getByRole('button',{name:/^入力設定/}).click();
    const afterReset=await page.evaluate(()=>window.writes.length);
    await page.evaluate(()=>window.testRaw=200);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>window.writes.length),afterReset,'Monitoring must not write settings');
    assert.equal(await page.locator('input#iidx-effector-debounce').count(),0);
    for (const debounce of [50, 12, 0]) {
      await page.locator('input#iidx-button-debounce').fill(String(debounce));
      await page.waitForFunction(v => { const w=window.writes.filter(x=>x.id===1).at(-1); return w && w.data[75]===v && w.data[76]===v; }, debounce);
    }
    assert.equal(await page.locator('input#tt-ratio').getAttribute('max'),'10');
    await page.getByRole('button',{name:'ターンテーブル感度の説明',exact:true}).hover();
    const sensitivityTip=page.locator('[data-slot="tooltip-content"]');
    await sensitivityTip.waitFor({state:'visible'});
    for (const line of [
      'ターンテーブルの回転に対する入力量を調整します。',
      '感度10では1カウントで入力、感度5では2カウントで入力されます。',
      '感度1では10カウントで入力されます。'
    ]) assert.equal(await sensitivityTip.getByText(line,{exact:true}).count(),1);
    await page.mouse.move(1200,600,{steps:10});
    await sensitivityTip.waitFor({state:'hidden'});


    await page.locator('input#tt-ratio').fill('10');
    await page.waitForFunction(()=>window.writes.some(x=>x.id===1&&x.data[30]===10));
    await page.evaluate(()=>{window.failNextDiag=true;window.testRaw=77;});
    await page.waitForFunction(()=>document.querySelector('[role="meter"]')?.getAttribute('aria-valuenow')==='77');
    assert.equal(await page.getByText('値を取得できません。接続とファームウェアを確認してください。',{exact:true}).count(),0);
    const sustain=await page.locator('input#tt-sustain-ms').boundingBox();const delay=await page.locator('input#tt-delay-ms').boundingBox();const ratio=await page.locator('input#tt-ratio').boundingBox();const bar=await meter.boundingBox();
    assert(sustain.y < delay.y && delay.y < ratio.y && ratio.y < bar.y,'Order must be hold time, delay, sensitivity, test');
    await page.screenshot({path:path.resolve('../../../outputs/settings-input-v1.00.png'),fullPage:true});
    await page.getByRole('button',{name:/^LED設定/}).click();
    assert.equal(await page.locator('input#button-led-fade').getAttribute('max'),'1000');
    for (const label of ['フェードアウト時間（ms）','ボタンLEDの明るさ（％）','ボタンLEDを反転']) {
      await page.getByRole('button',{name:label+'の説明',exact:true}).hover();
      await page.locator('[data-slot="tooltip-content"]').waitFor({state:'visible'});
      await page.mouse.move(1200,600,{steps:10});
      await page.locator('[data-slot="tooltip-content"]').waitFor({state:'hidden'});
    }
    await page.waitForTimeout(100);const pausedReads=await page.evaluate(()=>window.reads);
    await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.reads),pausedReads);
    const linked=await page.getByText('ターンテーブルとセンターバーの発光効果を連動',{exact:true}).boundingBox();const ttEffect=await page.getByText('ターンテーブルの発光効果',{exact:true}).boundingBox();
    assert(linked.y < ttEffect.y,'Linked lighting switch must be above the turntable effect');
    await page.screenshot({path:path.resolve('../../../outputs/settings-led-v1.00.png'),fullPage:true});
    await page.getByRole('button',{name:/^コントローラーモニター/}).click();
    await page.getByText('入力取得中',{exact:true}).waitFor();
    await page.evaluate(()=>window.testRaw=174);
    await page.getByText('X軸',{exact:true}).waitFor();
    await page.getByTestId('monitor-axis-value').getByText('174/255',{exact:true}).waitFor();
    assert.equal(await page.getByText('枠：押下状態 ／ 明るさ：LED出力',{exact:true}).count(),0);
    assert.equal(await page.getByTestId('monitor-side').evaluate(el=>getComputedStyle(el).fontSize),'16px');
    assert.equal(await page.getByTestId('monitor-tt-effect').innerText(),'固定');
    assert.equal(await page.getByTestId('monitor-bar-effect').innerText(),'固定');
    const separatorStyles=await page.locator('.status-row + .status-row').evaluateAll(rows=>rows.map(el=>getComputedStyle(el).borderTopStyle));
    assert(separatorStyles.length >= 2 && separatorStyles.every(style=>style==='solid'),'Status rows must have separators');
    assert.equal(await page.getByText('回転方向',{exact:true}).count(),0);
    assert.equal(await page.getByRole('meter',{name:'モニターX軸',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:/アニメーション/}).count(),0);
    assert.equal(await page.getByRole('button',{name:'設定を初期化',exact:true}).count(),0);
    const monitorWrites=await page.evaluate(()=>window.writes.length);
    assert.equal(await page.getByTestId('monitor-ring').getAttribute('data-led-source'),'simulation');
    assert((await page.locator('.bar').evaluate(el=>getComputedStyle(el).backgroundImage)).startsWith('linear-gradient'));
    await page.getByRole('button',{name:'2P',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'2P',exact:true}).getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'1P',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.writes.length),monitorWrites,'Monitor controls must not write config');
    const deviceBox=await page.locator('.device').boundingBox();const discBox=await page.locator('.disc-area').boundingBox();const keyboardBox=await page.locator('.keyboard').boundingBox();
    assert(discBox.width/deviceBox.width > 0.47,'Reference layout must use a large left turntable panel');
    assert.equal(await page.locator('.keyboard .key').count(),11,'Reference layout must keep 4 upper, 3 middle and 4 lower buttons');
    assert(keyboardBox.width/deviceBox.width > 0.39,'Reference layout must keep the right button panel');
    const firstKeyBox=await page.locator('.keyboard .key').first().boundingBox();
    assert(firstKeyBox.width/keyboardBox.width < 0.17,'Controller buttons must match the smaller mockup proportions');
    assert(firstKeyBox.height/keyboardBox.height < 0.24,'Main controller buttons must use shorter vertical proportions');
    await page.screenshot({path:path.resolve('../../../outputs/controller-monitor-v1.00.png'),fullPage:true});
    await page.getByRole('button',{name:/^入力設定/}).click();
    await page.getByRole('button',{name:'設定を初期化',exact:true}).waitFor();
    assert.equal(await page.locator('input#tt-ratio').inputValue(),'10');
    await page.getByRole('button',{name:/^ファームウェア/}).click();
    await page.waitForTimeout(80);const reads=await page.evaluate(()=>window.reads);
    await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.reads),reads);
    assert.deepEqual(errors,[]);console.log('PASS: live values, sensitivity write, transient read recovery, read-only display, placement, stop on unmount; mock HID');
  } finally {if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
