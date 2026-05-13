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

  // Try direct semester path
  const sem = 1;
  const iaUrl = `${UUCMS_BASE_URL}/InternalAssessmentMarks/MarksforStudent/${sem}`;
  console.log(`Fetching IA Marks from: ${iaUrl}`);
  const iaPage = await client.get(iaUrl);
  
  const $ia = cheerio.load(iaPage.data);
  const table = $ia('table').first();
  console.log(`Found ${$ia('table').length} tables`);
  
  if (table.length && table.text().includes('Course Code')) {
    console.log('SUCCESS: IA Marks loaded via simple path!');
    table.find('tr').slice(1, 3).each((i, row) => {
        console.log(`Row ${i+1}: ${$ia(row).text().replace(/\s+/g, ' ').trim()}`);
    });
  } else {
    console.log('FAILURE: Simple path did not return the table. Redirected?');
    console.log('Final URL:', iaPage.request.res.responseUrl);
  }
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
