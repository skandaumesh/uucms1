const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const CryptoJS = require('crypto-js');
const fs = require('fs');
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
  
  const photoUrl = 'https://uucms.karnataka.gov.in/Admission/DownloadFile?enc=XMm2yDBWE3WBummeoNay6nvrmLnk/v43M2p0eLbQ8ZsnS+GYDJXlUnae+HnZq9nY9Iyql4WFgHYLJcVBUVw4ag==';
  
  console.log(`Testing Photo Link: ${photoUrl}`);
  
  try {
     const res = await client.get(photoUrl, {
        responseType: 'arraybuffer'
     });
     console.log("Success! Status:", res.status);
     console.log("Content-Type:", res.headers['content-type']);
     console.log("Data Length:", res.data.length);
     fs.writeFileSync('scratch/download_test.jpg', res.data);
  } catch (e) {
     console.log("Failed:", e.message);
  }
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
