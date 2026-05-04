const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(30000);

  await page.goto('https://daotao.qnu.edu.vn/login', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  const usernameInput = await page.$('.MuiInputBase-input:not([type="password"])') 
                     || (await page.$$('input[type="text"]'))[0];
  if(usernameInput) {
    await usernameInput.click({ clickCount: 3 });
    await usernameInput.type('4751190039', { delay: 50 });
  }
  const passwordInput = await page.$('input[type="password"]');
  if(passwordInput) {
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type('Dvta01234', { delay: 50 });
  }
  await page.evaluate(() => {
    const muiBtn = document.querySelector('button.MuiButton-containedPrimary');
    if (muiBtn) { muiBtn.click(); return; }
    const loginBtn = Array.from(document.querySelectorAll('button')).find(b => (b.innerText||'').toLowerCase().includes('đăng nhập'));
    if(loginBtn) loginBtn.click();
  });
  try { await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 15000 }); } catch (e) {}

  await page.goto('https://daotao.qnu.edu.vn/student/schedules', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 5000));

  // Debug: in ra tất cả các tabs và text của chúng
  const tabInfo = await page.evaluate(() => {
     const tabs = Array.from(document.querySelectorAll('.MuiTab-root, [role="tab"], .tab'));
     return tabs.map(t => ({
       tag: t.tagName,
       text: t.textContent,
       innerHTML: t.innerHTML.substring(0, 100),
       classes: t.className
     }));
  });
  console.log('All tabs:', JSON.stringify(tabInfo, null, 2));

  // Thử click tab thứ 2 (index 1) - THỜI KHÓA BIỂU SINH VIÊN
  const allTabs = await page.$$('.MuiTab-root, [role="tab"]');
  console.log('Tab count:', allTabs.length);
  
  if (allTabs.length >= 2) {
    await allTabs[1].click();
    console.log('Clicked tab index 1');
  }
  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: 'step2_after_tab.png', fullPage: true });

  // Debug buttons
  const buttonInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText?.trim(),
      classes: b.className?.substring(0, 80)
    })).filter(b => b.text);
  });
  console.log('Buttons:', JSON.stringify(buttonInfo, null, 2));

  await browser.close();
}
run();
