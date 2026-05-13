const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const CryptoJS = require('crypto-js');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const UUCMS_BASE_URL = 'https://uucms.karnataka.gov.in';

const encryptPassword = (password) => {
  const key = CryptoJS.enc.Utf8.parse('8080808080808080');
  const iv = CryptoJS.enc.Utf8.parse('8080808080808080');
  const encrypted = CryptoJS.AES.encrypt(password, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString();
};

async function runTest(username, password) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar, withCredentials: true }));

  console.log('--- Step 1: Initial Login Page ---');
  const loginPageRes = await client.get(`${UUCMS_BASE_URL}/Login/Index`);
  const $login = cheerio.load(loginPageRes.data);
  const csrfToken = $login('input[name="__RequestVerificationToken"]').val();
  
  // Captcha generation (mimicking CaptchaLib.js)
  const digits = Array.from({ length: 5 }, () => Math.ceil(Math.random() * 9));
  const generatedCaptcha = digits.join(' ');
  const inputCaptcha = digits.join('');

  console.log('--- Step 2: Posting Login ---');
  const formData = new URLSearchParams();
  formData.append('model[HiddenUserName]', encryptPassword(username));
  formData.append('model[HiddenPassword]', encryptPassword(encodeURIComponent(password)));
  formData.append('model[organization]', 'Student');
  formData.append('model[loginType]', 'Regular');
  formData.append('model[HiddenGeneratedCaptcha]', encryptPassword(generatedCaptcha));
  formData.append('model[HiddenInputCaptcha]', encryptPassword(inputCaptcha));
  formData.append('__RequestVerificationToken', csrfToken);

  const loginRes = await client.post(`${UUCMS_BASE_URL}/Login/Index`, formData.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${UUCMS_BASE_URL}/Login/Index`,
    }
  });

  console.log('Login Result:', loginRes.data);

  if (!loginRes.data.redirectTo?.includes('OnLoginSucess')) {
    console.error('Login failed!');
    return;
  }

  console.log('--- Step 3: Success Page ---');
  await client.get(`${UUCMS_BASE_URL}/Login/OnLoginSucess`);

  console.log('--- Step 4: Fetching Exam Applications AJAX ---');
  const appsRes = await client.post(`${UUCMS_BASE_URL}/ExamGeneral/GetExamApplications`, 
    `__RequestVerificationToken=${csrfToken}`,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      }
    }
  );

  const apps = appsRes.data;
  console.log(`Found ${apps.length} applications`);
  if (apps.length > 0) {
    console.log('First App Object Keys:', Object.keys(apps[0]));
    console.log('First App Sample:', JSON.stringify(apps[0], null, 2));
  }

  for (const app of apps) {
    console.log(`\nProcessing App: ${app.examMonth} (ID: ${app.enbs_id})`);
    
    const resultUrl = `${UUCMS_BASE_URL}/ExamReEvaluation/StudentExamResult?enbsId=${app.enbs_id}&StudentregistrationNo=${username}`;
    console.log(`Fetching: ${resultUrl}`);
    
    const resultRes = await client.get(resultUrl);
    const $result = cheerio.load(resultRes.data);
    
    const table = $result('table');
    console.log(`Tables found: ${table.length}`);
    
    table.each((i, t) => {
        const headers = $result(t).find('th').map((_, th) => $result(th).text().trim()).get();
        console.log(`Table ${i} headers: ${headers.join(' | ')}`);
        
        const rows = $result(t).find('tr');
        console.log(`Table ${i} rows: ${rows.length}`);
        
        rows.each((j, tr) => {
            const cols = $result(tr).find('td, th').map((_, el) => $result(el).text().trim()).get();
            if (cols.length > 5) {
                console.log(`Row ${j}: ${cols.join(' | ')}`);
            }
        });
    });

    // Save one for manual inspection
    fs.writeFileSync(path.join(__dirname, `test_result_${app.enbs_id}.html`), resultRes.data);
  }
}

const [,, user, pass] = process.argv;
runTest(user || 'U18ER22S0032', pass || '10-02-2005').catch(console.error);
