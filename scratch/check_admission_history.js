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
  
  console.log("Checking MIS Candidate History...");
  const res = await client.get(`${UUCMS_BASE_URL}/MIS/CandidateAdmissionTransactionHistory`);
  const $ = cheerio.load(res.data);
  
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href.includes('PreviewStudentApplicationDetails')) {
      console.log(`FOUND LINK: [${text}] -> ${href}`);
    }
  });

  console.log("\nChecking Upload Photo Page...");
  const photoRes = await client.get(`${UUCMS_BASE_URL}/Login/UploadPhotoandSignature`);
  const $photo = cheerio.load(photoRes.data);
  const img = $photo('img#imgPhoto');
  console.log(`Photo element found: ${img.length > 0 ? img.attr('src') : 'No'}`);
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
