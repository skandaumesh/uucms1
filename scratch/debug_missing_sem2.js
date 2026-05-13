const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const CryptoJS = require('crypto-js');
const cheerio = require('cheerio');

const UUCMS_BASE_URL = 'https://uucms.karnataka.gov.in';

const encryptPassword = (password) => {
  const key = CryptoJS.enc.Utf8.parse('8080808080808080');
  const iv = CryptoJS.enc.Utf8.parse('8080808080808080');
  return CryptoJS.AES.encrypt(password, key, { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }).toString();
};

async function runTest(username, password) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar, withCredentials: true }));

  // Login
  const loginPageRes = await client.get(`${UUCMS_BASE_URL}/Login/Index`);
  const $login = cheerio.load(loginPageRes.data);
  const csrfToken = $login('input[name="__RequestVerificationToken"]').val();
  const digits = Array.from({ length: 5 }, () => Math.ceil(Math.random() * 9));
  const generatedCaptcha = digits.join(' ');

  const formData = new URLSearchParams();
  formData.append('model[HiddenUserName]', encryptPassword(username));
  formData.append('model[HiddenPassword]', encryptPassword(encodeURIComponent(password)));
  formData.append('model[organization]', 'Student');
  formData.append('model[loginType]', 'Regular');
  formData.append('model[HiddenGeneratedCaptcha]', encryptPassword(generatedCaptcha));
  formData.append('model[HiddenInputCaptcha]', encryptPassword(digits.join('')));
  formData.append('__RequestVerificationToken', csrfToken);

  await client.post(`${UUCMS_BASE_URL}/Login/Index`, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }
  });
  await client.get(`${UUCMS_BASE_URL}/Login/OnLoginSucess`);

  const appsRes = await client.get(`${UUCMS_BASE_URL}/ExamGeneral/ExamApplications`);
  const $apps = cheerio.load(appsRes.data);
  const token = $apps('input[name="__RequestVerificationToken"]').val();

  const ajaxRes = await client.post(`${UUCMS_BASE_URL}/ExamGeneral/GetExamApplications?SessionSarID=`, {}, {
    headers: { 'X-Requested-With': 'XMLHttpRequest', '__RequestVerificationToken': token }
  });
  
  const examApps = ajaxRes.data.data || ajaxRes.data;
  console.log(`Found ${examApps.length} Exam Applications`);

  for (const app of examApps) {
    console.log(`- App: ${app.examMonth} | Id: ${app.Id}`);
    
    const resultPageUrl = `${UUCMS_BASE_URL}/ExamReEvaluation/StudentExamResult?enbsId=${app.Id}&StudentregistrationNo=${username}`;
    const pageRes = await client.get(resultPageUrl);
    const $ = cheerio.load(pageRes.data);
    
    const termOptions = [];
    $('#ddl_std_term option').each((_, el) => {
      const val = $(el).attr('value');
      const text = $(el).text().trim();
      if (val) termOptions.push({ value: val, text });
    });

    console.log(`  Terms found: ${termOptions.map(t => t.text).join(', ')}`);
    
    for (const term of termOptions) {
        const ajaxUrl = `${UUCMS_BASE_URL}/ExamReEvaluation/StudentTermExamResult?termId=${term.value}&enbsid=${app.Id}`;
        const termRes = await client.get(ajaxUrl);
        const data = termRes.data;
        if (Array.isArray(data) && data.length > 0) {
            console.log(`    SUCCESS: ${term.text} has ${data.length} subjects. Result Status: ${data[0].ERStatus}`);
        } else {
            console.log(`    EMPTY: ${term.text} has no data.`);
        }
    }
  }
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
