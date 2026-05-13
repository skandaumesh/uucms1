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

  // Navigate to Exam Applications to look for IA Marks links
  const appsPage = await client.get(`${UUCMS_BASE_URL}/ExamGeneral/ExamApplications`);
  const $apps = cheerio.load(appsPage.data);
  
  console.log('--- Links on Exam Applications Page ---');
  $apps('a').each((i, el) => {
    const href = $apps(el).attr('href');
    const text = $apps(el).text().trim();
    if (href && (href.includes('InternalAssessmentMarks') || href.includes('MarksforStudent'))) {
      console.log(`FOUND IA LINK: [${text}] -> ${href}`);
    }
  });

  // Try sidebar menu
  console.log('\n--- Searching Sidebar Menu ---');
  $apps('.nav-item, .menu-item, a').each((i, el) => {
    const text = $apps(el).text().trim();
    if (text.includes('Internal') || text.includes('IA')) {
        console.log(`Menu Item: ${text} | Href: ${$apps(el).attr('href')}`);
    }
  });
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
