import * as cheerio from 'cheerio';

export const parseAttendance = (html: string) => {
  const $ = cheerio.load(html);
  const subjects: any[] = [];
  
  $('table').each((_, table) => {
    const tableText = $(table).text().toLowerCase();
    if (tableText.includes('attendance') || tableText.includes('attended') || tableText.includes('percentage')) {
      $(table).find('tr').each((_, tr) => {
        const firstColText = $(tr).find('td, th').first().text().trim().toLowerCase();
        if (firstColText.includes('sl') || firstColText.includes('subject')) return;

        const cols = $(tr).find('td').map((_, el) => $(el).text().trim()).get();
        if (cols.length >= 6 && !cols[0].toLowerCase().includes('sl')) {
           const percentageStr = cols.find(c => c.includes('%')) || cols[6] || cols[5];
           const percentageVal = parseFloat(percentageStr?.replace('%', '')) || 0;
           subjects.push({
             slNo: cols[0],
             courseCode: cols[1],
             subjectName: cols[2],
             component: cols[3] || 'THEORY',
             totalClasses: parseInt(cols[4]) || 0,
             attendedClasses: parseInt(cols[5]) || 0,
             percentage: percentageVal,
             status: cols[7] || '',
             shortage: cols[8] || 'No'
           });
        }
      });
    }
  });

  return subjects;
};

/**
 * Parse profile from the StudentProfile page HTML.
 * We parse each page separately to avoid cross-contamination from menu text.
 */
export const parseProfile = (successHtml: string, profileHtml: string, appsHtml: string) => {
  // --- Extract name from the .login-name element ---
  // UUCMS has: <p class="login-name">SKANDA M U UMESH (MLA Academy of Higher Learning, Malleswaram, )</p>
  let name = '';
  let collegeName = '';
  const $success = cheerio.load(successHtml);
  
  const loginNameText = $success('.login-name').text().trim();
  console.log(`[Parser] .login-name text: "${loginNameText}"`);
  
  if (loginNameText) {
    // Split on first '(' to get name and college
    const parenIndex = loginNameText.indexOf('(');
    if (parenIndex > 0) {
      name = loginNameText.substring(0, parenIndex).trim();
      collegeName = loginNameText.substring(parenIndex + 1).replace(/\)\s*$/, '').trim();
    } else {
      name = loginNameText;
    }
  }
  
  // Try login-user-align section (common UUCMS layout)
  if (!name) {
    const loginUserText = $success('.login-user-align').text().trim();
    console.log(`[Parser] login-user-align text: "${loginUserText.substring(0, 200)}"`);
    const userMatch = loginUserText.match(/([A-Z][A-Z\s]{3,40})\s*\(/);
    if (userMatch) name = userMatch[1].trim();
  }
  
  // Try looking at the raw HTML for the name pattern: >NAME (Student)<
  if (!name) {
    const htmlNameMatch = successHtml.match(/>([A-Z][A-Z\s]{4,40})\s*\(\s*Student/);
    if (htmlNameMatch) name = htmlNameMatch[1].trim();
  }
  
  // Fallback: try to find name in the profile page
  if (!name) {
    const $profile = cheerio.load(profileHtml);
    name = $profile('input#StudentName').val() as string ||
           $profile('input[name="StudentName"]').val() as string || '';
    
    // Try login-user-align on profile page
    if (!name) {
      const profileUserText = $profile('.login-user-align').text().trim();
      const profileUserMatch = profileUserText.match(/([A-Z][A-Z\s]{3,40})\s*\(/);
      if (profileUserMatch) name = profileUserMatch[1].trim();
    }
    
    // Try raw HTML pattern on profile page
    if (!name) {
      const profileHtmlMatch = profileHtml.match(/>([A-Z][A-Z\s]{4,40})\s*\(\s*Student/);
      if (profileHtmlMatch) name = profileHtmlMatch[1].trim();
    }
    
    // Try label-value pairs on the profile page
    if (!name) {
      $profile('td, th, label').each((_, el) => {
        const text = $profile(el).text().trim();
        if (text === 'Student Name' || text === 'Student Name:') {
          const nextText = $profile(el).next().text().trim();
          if (nextText && nextText.length > 2 && !nextText.includes('Discipline')) {
            name = nextText;
          }
        }
      });
    }
  }
  
  // Try to find a basic photo in the success page or main profile page
  let basicPhoto = '';
  const $profile = cheerio.load(profileHtml);
  
  // Check Success Page
  const $successImg = $success('img[src*="ShowProfilePhoto"], img[src*="Photo"]');
  // Check Profile Page
  const $profileImg = $profile('#imgPhoto, #ProfilePhoto, #imgStudentPhoto, img[src*="ShowProfilePhoto"]');
  
  const targetImg = $profileImg.length > 0 ? $profileImg : $successImg;
  
  if (targetImg.length > 0) {
    basicPhoto = targetImg.attr('src') || '';
    if (basicPhoto && !basicPhoto.startsWith('http')) {
      basicPhoto = `https://uucms.karnataka.gov.in${basicPhoto.startsWith('/') ? '' : '/'}${basicPhoto}`;
    }
  }

  // --- Extract other profile info from all pages ---
  const $apps = cheerio.load(appsHtml);
  
  // Helper to extract from profile page only (avoids menu contamination)
  const extractFromProfile = (label: string) => {
    let val = '';
    $profile('td, th, label').each((_, el) => {
      const text = $profile(el).text().trim();
      if (text.includes(label) && text.length < label.length + 5) {
        const nextText = $profile(el).next().text().trim();
        if (nextText) val = nextText;
      }
    });
    // Also check input fields
    if (!val) {
      val = $profile(`input[name*="${label}"]`).val() as string || '';
    }
    return val;
  };

  // Extract SGPA/CGPA from ExamApplications page
  const appsText = $apps('body').text();
  const sgpaMatch = appsText.match(/SGPA\s*[:\-]\s*([\d.]+)/i);
  const cgpaMatch = appsText.match(/CGPA\s*[:\-]\s*([\d.]+)/i);

  return {
    name: name || '',
    photoUrl: basicPhoto || '',
    registerNumber: extractFromProfile('Register') || extractFromProfile('Registration'),
    semester: extractFromProfile('Semester') || extractFromProfile('Term'),
    collegeName: collegeName || extractFromProfile('College') || extractFromProfile('Institution'),
    courseName: extractFromProfile('Course') || extractFromProfile('Program'),
    sgpa: sgpaMatch ? sgpaMatch[1] : '',
    cgpa: cgpaMatch ? cgpaMatch[1] : '',
    pendingFees: 0,
  };
};

export const extractLatestAttendanceLink = (html: string) => {
  const $ = cheerio.load(html);
  let latestLink = '';
  
  $('a').each((i, el) => {
    const text = $(el).text().trim().toLowerCase();
    const href = $(el).attr('href') || '';
    if (text.includes('attendance') && href !== '#' && href.length > 1) {
      console.log(`[Parser] Found Attendance Link: "${text}" -> ${href}`);
      latestLink = href;
    }
  });
  
  console.log(`[Parser] Latest Attendance Link: "${latestLink}"`);
  return latestLink;
};

/**
 * Find the exam result link. 
 * UUCMS has results at /ExamReEvaluation/StudentExamResult?enc=...
 * We look for any link containing 'ExamResult' or 'StudentExamResult'
 */
export const extractLatestResultLink = (html: string) => {
  const $ = cheerio.load(html);
  let latestLink = '';
  
  // Search ALL links for anything pointing to exam results
  $('a').each((i, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    
    // Match links to exam result pages (not "Rejection")
    if (href.includes('ExamResult') || href.includes('StudentExamResult')) {
      console.log(`[Parser] Found Result Link: "${text}" -> ${href}`);
      latestLink = href;
    }
    // Also match "View Result" text (case-insensitive)
    if (text.toLowerCase() === 'view result' || text.toLowerCase() === 'view results') {
      console.log(`[Parser] Found Result Link (text match): "${text}" -> ${href}`);
      latestLink = href;
    }
  });
  
  console.log(`[Parser] Latest Result Link: "${latestLink}"`);
  return latestLink;
};

/**
 * Parse the exam result page HTML.
 * Based on the UUCMS result table structure:
 * Sl.No | Course Code | Course Name | Max Marks | Min Marks | SEE Marks | IA Marks | Marks Scored | Credits | Grade | Credit Points | Letter Grade | Status
 */
export const parseResults = (html: string) => {
  const $ = cheerio.load(html);
  const subjects: any[] = [];
  
  // Extract SGPA and CGPA from text like "SGPA : 8.82  CGPA : 8.33"
  const fullText = $('body').text();
  const sgpaMatch = fullText.match(/SGPA\s*[:\-]\s*([\d.]+)/i);
  const cgpaMatch = fullText.match(/CGPA\s*[:\-]\s*([\d.]+)/i);
  
  const sgpa = sgpaMatch ? sgpaMatch[1] : '';
  const cgpa = cgpaMatch ? cgpaMatch[1] : '';
  
  // Also extract student name and register number if available
  const studentNameMatch = fullText.match(/Student\s*Name\s*[:\-]?\s*([A-Z][A-Z\s]+[A-Z])/);
  const regNoMatch = fullText.match(/Student\s*Reg\s*No\s*[:\-]?\s*([A-Z0-9]+)/i);
  
  // Extract subjects from result table
  $('table').each((_, table) => {
    const headers = $(table).find('th').map((_, th) => $(th).text().trim()).get();
    const hasRelevantHeaders = headers.some(h => 
      h.includes('Course') || h.includes('Subject') || h.includes('Grade')
    );
    
    if (hasRelevantHeaders && headers.length >= 5) {
      console.log(`[Parser] Found result table with headers: ${headers.join(' | ')}`);
      
      $(table).find('tr').each((rowIndex, tr) => {
        const cols = $(tr).find('td, th').map((_, el) => $(el).text().trim()).get();
        
        if (cols.length > 0) {
          console.log(`[Parser] Row ${rowIndex} has ${cols.length} columns`);
        }

        if (cols.length >= 10 && !cols[0].includes('Sl.No')) {
          subjects.push({
            slNo: cols[0],
            code: cols[1],
            name: cols[2],
            maxMarks: parseInt(cols[3]) || 0,
            minMarks: parseInt(cols[4]) || 0,
            seeMarks: parseInt(cols[5]) || 0,
            iaMarks: parseInt(cols[6]) || 0,
            marksScored: parseInt(cols[7]) || 0,
            credits: parseInt(cols[8]) || 0,
            grade: parseFloat(cols[9]) || 0,
            creditPoints: parseFloat(cols[10]) || 0,
            letterGrade: cols[11] || '',
            result: cols[12] || 'Pass',
          });
        }
      });
    }
  });

  console.log(`[Parser] Extracted ${subjects.length} subjects, SGPA: ${sgpa}, CGPA: ${cgpa}`);
  if (studentNameMatch) console.log(`[Parser] Student Name from results: "${studentNameMatch[1]}"`);

  return {
    sgpa: parseFloat(sgpa) || 0,
    cgpa: parseFloat(cgpa) || 0,
    studentName: studentNameMatch ? studentNameMatch[1].trim() : '',
    registerNumber: regNoMatch ? regNoMatch[1] : '',
    subjects,
  };
};

export const parseIAMarks = (html: string) => {
  const $ = cheerio.load(html);
  const subjects: any[] = [];
  
  let targetTable = $('#tblTotalMarks');
  if (targetTable.length === 0) {
    $('table').each((_, t) => {
      const text = $(t).text().toLowerCase();
      if (text.includes('component') || text.includes('marks scored')) {
        targetTable = $(t);
      }
    });
  }

  if (targetTable.length > 0) {
    targetTable.find('tr').each((_, tr) => {
      const cols = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
      if (cols.length >= 6 && !cols[0].toLowerCase().includes('sl')) {
        subjects.push({
          slNo: cols[0],
          courseCode: cols[1],
          courseName: cols[2],
          component: cols[3],
          maxMarks: parseFloat(cols[4]) || 0,
          marksScored: parseFloat(cols[5]) || 0,
          percentage: (parseFloat(cols[5]) || 0) / (parseFloat(cols[4]) || 1) * 100
        });
      }
    });
  }

  return subjects;
};

export const parseFullProfile = (html: string) => {
  const $ = cheerio.load(html);
  
  // Aggressive photo detection
  let photoUrl = '';
  const photoCandidates = [
    '#imgPhoto', '#ProfilePhoto', '#imgStudentPhoto', 
    'img[src*="ShowProfilePhoto"]', 'img[src*="StudentPhoto"]',
    '.profile-img img', '#content_imgPhoto'
  ];
  
  for (const selector of photoCandidates) {
    const img = $(selector);
    if (img.length > 0) {
      photoUrl = img.attr('src') || '';
      if (photoUrl && photoUrl.length > 10) break;
    }
  }

  // Try to find a high-fidelity photo from the preview page
  if (!photoUrl) {
    const $img = $('img[src*="ShowProfilePhoto"], img[src*="Photo"], img[src*="DownloadFile"], #imgPhoto, #ProfilePhoto');
    if ($img.length > 0) {
      photoUrl = $img.first().attr('src') || '';
    }
  }

  if (photoUrl && !photoUrl.startsWith('http')) {
    photoUrl = `https://uucms.karnataka.gov.in${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
  }

  const getLabelValue = (label: string) => {
    let val = '';
    const searchLabel = label.toLowerCase();
    $('td, th, label, b, strong').each((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      
      // Flexible matching for labels with/without colons
      if (text === searchLabel || text === `${searchLabel} :` || text.startsWith(`${searchLabel} :`) || (text.includes(searchLabel) && text.length < label.length + 5)) {
        // 1. Try next sibling text
        let next = $(el).next().text().trim();
        // 2. Try next cell in row
        if (!next) next = $(el).closest('td, th').next('td, th').text().trim();
        // 3. Try to find any text in the same row but later columns
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
          return false; // Break loop
        }
      }
    });
    return val;
  };

  return {
    photoUrl,
    candidateId: getLabelValue('Candidate ID') || getLabelValue('Candidate'),
    registerNumber: getLabelValue('Registration Number') || getLabelValue('Register') || getLabelValue('Register No'),
    fatherName: getLabelValue("Father's Name") || getLabelValue('Father Name') || getLabelValue('Father'),
    motherName: getLabelValue("Mother's Name") || getLabelValue('Mother Name') || getLabelValue('Mother'),
    dob: getLabelValue('Date of Birth') || getLabelValue('Birth') || getLabelValue('DOB'),
    gender: getLabelValue('Gender'),
    category: getLabelValue('Category') || getLabelValue('Caste'),
    bloodGroup: getLabelValue('Blood'),
    mobile: getLabelValue('Primary Mobile No') || getLabelValue('Mobile') || getLabelValue('Primary'),
    email: getLabelValue('Email Address') || getLabelValue('Email'),
    aadhaar: getLabelValue('Aadhaar No') || getLabelValue('Aadhaar'),
    address: getLabelValue('Address'),
  };
};
