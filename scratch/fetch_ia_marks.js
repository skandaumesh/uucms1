const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const CryptoJS = require('crypto-js');
const cheerio = require('cheerio');
const fs = require('fs');

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

  // Fetch the IA Marks page provided by user
  const iaUrl = 'https://uucms.karnataka.gov.in/InternalAssessmentMarks/MarksforStudent/?enc=sVqmbRqU5uvQnKG+d9WeUg==';
  console.log(`Fetching IA Marks from: ${iaUrl}`);
  const iaPage = await client.get(iaUrl);
  
  fs.writeFileSync('scratch/ia_marks.html', iaPage.data);
  console.log('Saved IA Marks page to scratch/ia_marks.html');

  const $ia = cheerio.load(iaPage.data);
  const table = $ia('table').first();
  console.log(`Found ${$ia('table').length} tables`);
  
  if (table.length) {
    console.log('Table Headers:');
    table.find('th').each((i, el) => console.log(`- ${$ia(el).text().trim()}`));
    
    console.log('\nFirst Row Data:');
    table.find('tr').eq(1).find('td').each((i, el) => console.log(`- ${$ia(el).text().trim()}`));
  }
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
