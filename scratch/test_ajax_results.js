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

  const loginRes = await client.post(`${UUCMS_BASE_URL}/Login/Index`, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Referer': `${UUCMS_BASE_URL}/Login/Index` }
  });
  console.log('Login:', loginRes.data.redirectTo ? 'SUCCESS' : 'FAILED');
  if (!loginRes.data.redirectTo?.includes('OnLoginSucess')) return;
  await client.get(`${UUCMS_BASE_URL}/Login/OnLoginSucess`);

  // Get exam apps
  const appsRes = await client.post(`${UUCMS_BASE_URL}/ExamGeneral/GetExamApplications?SessionSarID=`, {}, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  });
  const apps = appsRes.data;
  console.log(`Found ${apps.length} exam applications\n`);

  // For each app, get result page, extract terms, call AJAX
  for (const app of apps) {
    const enbsId = app.Id;
    console.log(`=== ${app.examMonth} (enbsId=${enbsId}) ===`);

    // Load result page to get term dropdown
    const pageRes = await client.get(`${UUCMS_BASE_URL}/ExamReEvaluation/StudentExamResult?enbsId=${enbsId}&StudentregistrationNo=${username}`, {
      headers: { 'Accept': 'text/html' }
    });
    const $ = cheerio.load(pageRes.data);
    const terms = [];
    $('#ddl_std_term option').each((_, el) => {
      terms.push({ value: $(el).attr('value'), text: $(el).text().trim() });
    });
    console.log(`Terms: ${terms.map(t => `${t.text}(${t.value})`).join(', ')}`);

    // Call AJAX for each term
    for (const term of terms) {
      const url = `${UUCMS_BASE_URL}/ExamReEvaluation/StudentTermExamResult?termId=${term.value}&enbsid=${enbsId}`;
      console.log(`  Fetching term ${term.text}...`);
      try {
        const res = await client.get(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        const data = res.data;
        if (Array.isArray(data) && data.length > 0) {
          console.log(`  ✓ ${data.length} subjects found!`);
          console.log(`    SGPA: ${data[0].SGPA}, CGPA: ${data[0].CGPA}, Status: ${data[0].ERStatus}`);
          data.forEach((s, i) => {
            console.log(`    ${i+1}. ${s.CourseCode} - ${s.CourseName}: ${s.MarksScored}/${s.MaximumMarks} (${s.LetterGrade}) ${s.Status}`);
          });
        } else {
          console.log(`  ✗ No data`);
        }
      } catch (e) {
        console.log(`  ✗ Error: ${e.message}`);
      }
    }
    console.log('');
  }
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
