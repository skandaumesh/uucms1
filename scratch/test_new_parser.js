const cheerio = require('cheerio');
const fs = require('fs');

const html = fs.readFileSync('scratch/preview_full.html', 'utf8');
const $ = cheerio.load(html);

const getLabelValue = (label) => {
  let val = '';
  const searchLabel = label.toLowerCase();
  $('td, th, label, b, strong').each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    
    if (text === searchLabel || text === `${searchLabel} :` || text.startsWith(`${searchLabel} :`) || (text.includes(searchLabel) && text.length < label.length + 5)) {
      let next = $(el).next().text().trim();
      if (!next) next = $(el).closest('td, th').next('td, th').text().trim();
      if (!next) {
         const row = $(el).closest('tr');
         const cells = row.find('td, th');
         const index = cells.index($(el).closest('td, th'));
         if (index !== -1 && cells.eq(index + 1).length > 0) {
            next = cells.eq(index + 1).text().trim();
         }
      }
      
      if (next && next.length > 0 && next !== ':') {
        val = next;
        return false;
      }
    }
  });
  return val;
};

console.log("TESTING NEW PARSER ON SAVED HTML:");
console.log(`- Candidate ID: ${getLabelValue('Candidate ID')}`);
console.log(`- Registration Number: ${getLabelValue('Registration Number')}`);
console.log(`- Student Name: ${getLabelValue('Student Name')}`);
console.log(`- Father's Name: ${getLabelValue("Father's Name")}`);
console.log(`- Aadhaar No: ${getLabelValue('Aadhaar No')}`);
console.log(`- Mobile No: ${getLabelValue('Mobile No')}`);
