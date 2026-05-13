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

  console.log(`[TEST] Starting crawl for ${username}...`);

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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }
  });
  
  console.log("Login Response Status:", loginRes.status);
  console.log("Login Response Data:", JSON.stringify(loginRes.data).slice(0, 200));

  if (loginRes.data && (loginRes.data.status === 'success' || JSON.stringify(loginRes.data).includes('success') || loginRes.status === 200)) {
     console.log("Login Step Complete. Verifying Session...");
     const check = await client.get(`${UUCMS_BASE_URL}/Login/OnLoginSucess`);
     if (check.data.includes('Logout')) {
        console.log("Session Verified.");
     } else {
        console.log("Session Verification Failed (Not Logged In).");
        return;
     }
  } else {
     console.log("Login Failed.");
     return;
  }

  // 1. Sequential Discovery Loop
  const discoveryPaths = [
    '/Login/OnLoginSucess',
    '/StudentProfile/StudentProfile',
    '/ExamGeneral/ExamApplications',
    '/MIS/CandidateAdmissionTransactionHistory',
    '/Admission/StudentAdmissionStatusUpdatesView'
  ];

  let combinedHtml = '';
  for (const path of discoveryPaths) {
    try {
      console.log(`Checking: ${path}...`);
      const res = await client.get(`${UUCMS_BASE_URL}${path}`);
      if (res.data && !res.data.includes('NullReferenceException')) {
        combinedHtml += res.data;
        console.log(`- Success: ${path}`);
      } else {
        console.log(`- Failed: ${path} (Server Error)`);
      }
    } catch (e) {
      console.log(`- Error: ${path} (${e.message})`);
    }
  }

  // Save the full capture for manual inspection
  fs.writeFileSync('scratch/full_discovery_capture.html', combinedHtml);
  console.log("\nFull discovery HTML saved to scratch/full_discovery_capture.html");

  // 2. Search for Identity Link (More broad regex)
  const match = combinedHtml.match(/\/MIS\/PreviewStudentApplicationDetails\?enc=[A-Za-z0-9+/=]+/);
  const anyEncMatch = combinedHtml.match(/\?enc=[A-Za-z0-9+/=]{20,}/);
  
  if (match || anyEncMatch) {
    const linkStr = match ? match[0] : anyEncMatch[0];
    const previewUrl = linkStr.startsWith('http') ? linkStr : `${UUCMS_BASE_URL}${linkStr}`;
    console.log(`\nFOUND IDENTITY LINK: ${previewUrl}`);

    // 3. Fetch Preview Page
    console.log("Fetching Full Identity Page...");
    const previewRes = await client.get(previewUrl, {
       headers: { 'Referer': `${UUCMS_BASE_URL}/MIS/CandidateAdmissionTransactionHistory` }
    });

    if (previewRes.data.includes('NullReferenceException')) {
       console.log("CRITICAL ERROR: Preview page returned 500 error even with session.");
       fs.writeFileSync('scratch/error_page.html', previewRes.data);
    } else {
       console.log("SUCCESS! Parsing identity data...");
       const $ = cheerio.load(previewRes.data);
       
       const getVal = (label) => {
          let val = 'N/A';
          $('td, th, b, strong').each((_, el) => {
             const text = $(el).text().trim().toLowerCase();
             if (text.includes(label.toLowerCase())) {
                const next = $(el).next().text().trim() || $(el).closest('td, th').next('td, th').text().trim();
                if (next && next !== ':') {
                   val = next;
                   return false;
                }
             }
          });
          return val;
       };

       console.log(`- Student Name: ${getVal('Student Name')}`);
       console.log(`- Father's Name: ${getVal('Father')}`);
       console.log(`- Aadhaar: ${getVal('Aadhaar')}`);
       console.log(`- Mobile: ${getVal('Mobile')}`);

       // 4. Test Photo
       const $img = $('img[src*="ShowProfilePhoto"]');
       if ($img.length > 0) {
          const photoUrl = $img.attr('src');
          const fullPhotoUrl = photoUrl.startsWith('http') ? photoUrl : `${UUCMS_BASE_URL}${photoUrl}`;
          console.log(`\nPHOTO URL FOUND: ${fullPhotoUrl}`);
          
          console.log("Testing Photo Download...");
          const photoRes = await client.get(fullPhotoUrl, { responseType: 'arraybuffer' });
          fs.writeFileSync('scratch/test_photo.jpg', photoRes.data);
          console.log("PHOTO DOWNLOADED TO scratch/test_photo.jpg");
       } else {
          console.log("NO PHOTO URL FOUND ON PAGE.");
       }
    }
  } else {
    console.log("\nFAILED: No identity link found in any portal section.");
  }
}

runTest('U18ER22S0032', '10-02-2005').catch(console.error);
