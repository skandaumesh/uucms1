import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import upstash from '@/lib/upstash';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { SessionManager } from '@/services/uucms/sessionManager';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');
const UUCMS = 'https://uucms.karnataka.gov.in';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const uucmsId = payload.uucmsId as string;

    const cacheKey = `uucms:cache:${uucmsId}:results`;
    
    if (!forceRefresh) {
      const cached = await upstash.get(cacheKey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return NextResponse.json({ ...parsed, isCached: true });
      }
    }

    const session = await SessionManager.getSession(uucmsId);
    if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    try {
      const cookieString = session.cookies.map(c => c.split(';')[0]).join('; ');
      const commonHeaders = {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        '__RequestVerificationToken': session.requestVerificationToken,
      };

      // Ensure session is active for exams
      await axios.get(`${UUCMS}/ExamGeneral/ExamApplications`, {
        headers: { ...commonHeaders, 'Accept': 'text/html' }
      });

      // 1. Fetch all Exam Applications
      let examApps: any[] = [];
      const ajaxRes = await axios.post(`${UUCMS}/ExamGeneral/GetExamApplications?SessionSarID=`, {}, {
        headers: { ...commonHeaders, 'Referer': `${UUCMS}/ExamGeneral/ExamApplications` },
        timeout: 15000
      });
      
      const ajaxData = ajaxRes.data;
      if (Array.isArray(ajaxData)) examApps = ajaxData;
      else if (ajaxData?.data) examApps = ajaxData.data;

      const semesterMap = new Map<string, any>();

      // 2. Scan every application for every possible semester
      // Use Promise.all to speed up the scanning of multiple apps
      await Promise.all(examApps.map(async (app) => {
        const enbsId = app.Id;
        if (!enbsId) return;

        try {
          const resultPageUrl = `${UUCMS}/ExamReEvaluation/StudentExamResult?enbsId=${enbsId}&StudentregistrationNo=${uucmsId}`;
          const pageRes = await axios.get(resultPageUrl, {
            headers: { ...commonHeaders, 'Accept': 'text/html', 'Referer': `${UUCMS}/ExamGeneral/ExamApplications` },
            timeout: 10000
          });

          const $ = cheerio.load(pageRes.data);
          const termOptions: { value: string; text: string }[] = [];
          $('#ddl_std_term option').each((_, el) => {
            const val = $(el).attr('value');
            const text = $(el).text().trim().toUpperCase();
            if (val && val !== '0') termOptions.push({ value: val, text });
          });

          // Also check if there's a default selected term if no options found
          if (termOptions.length === 0) {
             const selectedTerm = $('#ddl_std_term option[selected]').text().trim().toUpperCase();
             const selectedVal = $('#ddl_std_term option[selected]').attr('value');
             if (selectedVal && selectedVal !== '0') termOptions.push({ value: selectedVal, text: selectedTerm });
          }

          for (const term of termOptions) {
            try {
              const ajaxUrl = `${UUCMS}/ExamReEvaluation/StudentTermExamResult?termId=${term.value}&enbsid=${enbsId}`;
              const termRes = await axios.get(ajaxUrl, { 
                headers: { ...commonHeaders, 'Referer': resultPageUrl }, 
                timeout: 10000 
              });
              
              const resultData = termRes.data;
              const subjectsData = Array.isArray(resultData) ? resultData : (resultData?.data || []);

              if (subjectsData.length > 0) {
                const status = subjectsData[0].ERStatus || '';
                // Only skip if absolutely necessary
                if (status === 'WITH HELD' || status === 'TAL') continue;

                const subjects = subjectsData.map((r: any, idx: number) => ({
                  slNo: String(idx + 1),
                  code: r.CourseCode || '',
                  name: r.CourseName || '',
                  maxMarks: r.MaximumMarks || 0,
                  minMarks: r.MinimumMarks || 0,
                  seeMarks: r.SEMarks || 0,
                  iaMarks: r.IAMarks || 0,
                  marksScored: r.MarksScored || 0,
                  credits: r.Credit || 0,
                  grade: r.Grade || 0,
                  creditPoints: r.GradePoint || 0,
                  letterGrade: r.LetterGrade || '',
                  result: r.Status || 'Pass',
                }));

                const romanToDigit: any = { 'VIII': '8', 'VII': '7', 'VI': '6', 'IV': '4', 'V': '5', 'III': '3', 'II': '2', 'I': '1' };
                const match = term.text.match(/\b(VIII|VII|VI|IV|V|III|II|I|\d+)\b/);
                let semName = match ? match[1] : term.text.replace(/SEMESTER|SEM/g, '').trim();
                if (romanToDigit[semName]) {
                  semName = romanToDigit[semName];
                }

                const semInfo = {
                  examMonth: app.examMonth || '',
                  termName: semName,
                  termId: term.value,
                  sgpa: parseFloat(subjectsData[0].SGPA) || 0,
                  cgpa: parseFloat(subjectsData[0].CGPA) || 0,
                  termGrade: subjectsData[0].TermGrade || '',
                  result: status,
                  subjects,
                };

                const existing = semesterMap.get(semName);
                if (!existing || semInfo.sgpa > existing.sgpa || semInfo.subjects.length > existing.subjects.length) {
                  semesterMap.set(semName, semInfo);
                }
              }
            } catch (e) {}
          }
        } catch (e) {}
      }));

      const allSemesters = Array.from(semesterMap.values()).sort((a, b) => {
        return parseInt(a.termName) - parseInt(b.termName);
      });

      if (allSemesters.length > 0) {
        const latest = allSemesters[allSemesters.length - 1];
        const responseData = {
          sgpa: latest.sgpa,
          cgpa: latest.cgpa,
          semesters: allSemesters,
          subjects: latest.subjects,
          registerNumber: uucmsId,
          lastSync: new Date(),
          isCached: false
        };

        await upstash.set(cacheKey, JSON.stringify(responseData), { ex: 86400 });
        return NextResponse.json(responseData);
      }

      return NextResponse.json({ semesters: [], isCached: true });

    } catch (error: any) {
      console.error('[Results API] Critical error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch academic records' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Results fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
