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

  // Navigate to Student Courses (where the back button points)
  console.log('Navigating to StudentCourses...');
  const coursesPage = await client.get(`${UUCMS_BASE_URL}/CourseRegistrationByStudent/StudentCourses`);
  const $courses = cheerio.load(coursesPage.data);
  
  console.log('--- Links on Student Courses Page ---');
  $courses('a').each((i, el) => {
    const href = $courses(el).attr('href');
    const text = $courses(el).text().trim();
    if (href && (href.includes('InternalAssessmentMarks') || href.includes('MarksforStudent'))) {
      console.log(`FOUND IA LINK: [${text}] -> ${href}`);
    }
  });

  // Try to find the IA Marks link in the table rows
  $courses('table tr').each((i, row) => {
    const rowText = $courses(row).text();
    if (rowText.includes('Internal') || rowText.includes('IA')) {
        const link = $courses(row).find('a').attr('href');
        console.log(`Table Row contains IA: ${rowText.substring(0, 50)}... | Link: ${link}`);
    }
  });
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
