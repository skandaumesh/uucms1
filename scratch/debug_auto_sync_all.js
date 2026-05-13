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
  
  const pages = [
    '/Login/OnLoginSucess',
    '/StudentProfile/StudentProfile',
    '/ExamGeneral/ExamApplications',
    '/MIS/CandidateAdmissionTransactionHistory',
    '/Admission/AdmissionStatus'
  ];

  let allHtml = '';
  for (const page of pages) {
    try {
      console.log(`Checking page: ${page}`);
      const res = await client.get(`${UUCMS_BASE_URL}${page}`);
      if (res.data.includes('NullReferenceException')) {
        console.log(`- FAILED: ${page} returned 500 error.`);
      } else {
        console.log(`- SUCCESS: ${page} fetched (${res.data.length} chars).`);
        allHtml += res.data;
      }
    } catch (e) {
      console.log(`- ERROR: ${page} failed: ${e.message}`);
    }
  }

  console.log("\nSEARCHING FOR PREVIEW LINK...");
  const match = allHtml.match(/\/MIS\/PreviewStudentApplicationDetails\?enc=[A-Za-z0-9+/=]+/);
  if (match) {
    console.log(`FOUND LINK: ${match[0]}`);
    const previewRes = await client.get(`${UUCMS_BASE_URL}${match[0]}`);
    if (previewRes.data.includes('NullReferenceException')) {
       console.log("PREVIEW PAGE FAILED (500 ERROR).");
    } else {
       console.log("PREVIEW PAGE SUCCESS! Parsing details...");
       const $ = cheerio.load(previewRes.data);
       // Simple test
       const name = $('td:contains("Student Name")').next().text().trim();
       console.log(`Extracted Name: ${name}`);
    }
  } else {
    console.log("COULD NOT FIND PREVIEW LINK ON ANY PAGE.");
  }
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
