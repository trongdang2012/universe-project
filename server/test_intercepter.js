const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'] });
  const page = await browser.newPage();
  
  // Set up interception
  let foundData = false;
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api/') || url.includes('/tkb') || url.includes('schedule') || url.includes('daotao.qnu.edu.vn')) {
      if (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
        try {
          const text = await response.text();
          if (text.includes('mon') || text.includes('subject') || text.includes('name') || text.includes('lopHocPhan')) {
             fs.appendFileSync('api_dump.txt', `\n\n--- URL: ${url} ---\n${text.substring(0, 1000)}...`);
             foundData = true;
          }
        } catch (e) {}
      }
    }
  });

  await page.setDefaultNavigationTimeout(30000);
  console.log('Navigating to login...');
  await page.goto('https://daotao.qnu.edu.vn/login', { waitUntil: 'domcontentloaded' });

  console.log('Waiting for username input...');
  const usernameInput = await page.$('.MuiInputBase-input:not([type="password"])') 
                     || (await page.$$('input[type="text"]'))[0]
                     || await page.$('input');
  
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
    const btns = Array.from(document.querySelectorAll('button'));
    const loginBtn = btns.find(b => {
      const text = (b.innerText || '').toLowerCase();
      return text.includes('đăng nhập') || text.includes('login');
    });
    if(loginBtn) loginBtn.click();
  });

  try { await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 15000 }); } catch (e) {}
  
  console.log('Going to schedules...');
  await page.goto('https://daotao.qnu.edu.vn/student/schedules', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));
  
  await page.evaluate(() => {
     const tabs = Array.from(document.querySelectorAll('a, button, li, .nav-link, span, .MuiTab-root'));
     const t = tabs.find(t => t.textContent && t.textContent.includes('THỜI KHÓA BIỂU SINH VIÊN'));
     if(t) t.click();
  });
  await new Promise(r => setTimeout(r, 4000));

  console.log('Selecting Hoc Ky 2...');
  try {
      const selects = await page.$$('.MuiSelect-select, .MuiInputBase-input');
      for (let sel of selects) {
          const txt = await page.evaluate(el => el.innerText || el.value || '', sel);
          if (txt.includes('Học kỳ')) {
              await sel.click();
              await new Promise(r => setTimeout(r, 1000));
              const options = await page.$$('[role="option"]');
              for (let opt of options) {
                  const optTxt = await page.evaluate(el => el.innerText || '', opt);
                  if (optTxt.includes('Học kỳ 2')) { await opt.click(); break; }
              }
              break;
          }
      }
  } catch (e) {}
  await new Promise(r => setTimeout(r, 3000));

  await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.innerText && b.innerText.includes('Hiện tại'));
      if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 4000));

  console.log('Wait 5s for table to populate');
  await new Promise(r => setTimeout(r, 5000));
  const html = await page.evaluate(() => {
      const table = document.querySelector('table');
      return table ? table.outerHTML : document.body.innerHTML;
  });
  fs.writeFileSync('student_schedule_html.txt', html);

  fs.writeFileSync('test_done.txt', 'Done waiting for API');
  await browser.close();
}
run();
