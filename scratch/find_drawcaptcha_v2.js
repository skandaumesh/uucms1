const axios = require('axios');

const baseUrl = 'https://uucms.karnataka.gov.in';
const scripts = [
  '/Scripts/jquery-3.7.0.min.js',
  '/Scripts/jquery.validate.min.js',
  '/Scripts/jquery.validate.unobtrusive.min.js',
  '/Scripts/jquery-ui.min.js',
  '/Scripts/aos.js',
  '/Scripts/moment.min.js',
  '/Scripts/aes.js',
  '/Scripts/jquery-dropdown-datepicker.min.js',
  '/Scripts/select2.min.js',
  '/Scripts/bootstrap.bundle.min.js',
  '/Scripts/bootstrap-multiselect-1.1.2.min.js',
  '/Scripts/bootbox.min.js',
  '/Scripts/jquery.dataTables.min.js',
  '/Scripts/dataTables.js',
  '/Scripts/dataTables.buttons.js',
  '/Scripts/buttons.dataTables.js',
  '/Scripts/jszip.min.js',
  '/Scripts/pdfmake.min.js',
  '/Scripts/vfs_fonts.js',
  '/Scripts/buttons.html5.min.js',
  '/Scripts/buttons.print.min.js',
  '/Scripts/dataTables.bootstrap5.3.min.js',
  '/Scripts/dataTables.fixedHeader.min.js',
  '/Scripts/common.js',
  '/Scripts/ajaxCall.js',
  '/Scripts/XSS-validation-0.0.1.js',
  '/Areas/Scripts/yearpicker.js'
];

async function find() {
  for (const s of scripts) {
    try {
      const res = await axios.get(baseUrl + (s.startsWith('http') ? '' : s));
      if (res.data.toLowerCase().includes('drawcaptcha')) {
        console.log(`Found DrawCaptcha in ${s}`);
        const idx = res.data.toLowerCase().indexOf('drawcaptcha');
        console.log(res.data.substring(idx - 50, idx + 500));
      }
    } catch (e) {}
  }
}

find();
