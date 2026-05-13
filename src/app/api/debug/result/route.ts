import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import axios from 'axios';
import { SessionManager } from '@/services/uucms/sessionManager';
import * as fs from 'fs';
import * as path from 'path';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');
const UUCMS = 'https://uucms.karnataka.gov.in';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const enbsId = searchParams.get('enbsId') || '4235';
    const regNo = searchParams.get('regNo') || 'U18ER22S0032';

    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const uucmsId = payload.uucmsId as string;

    const session = await SessionManager.getSession(uucmsId);
    if (!session) return NextResponse.json({ error: 'Session expired' }, { status: 401 });

    const cookieString = session.cookies.map(c => c.split(';')[0]).join('; ');
    const commonHeaders = {
      'Cookie': cookieString,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const url = `${UUCMS}/ExamReEvaluation/StudentExamResult?enbsId=${enbsId}&StudentregistrationNo=${regNo}`;
    console.log(`[Debug Result] Fetching: ${url}`);
    
    const res = await axios.get(url, { headers: commonHeaders });
    
    const scratchDir = path.join(process.cwd(), 'scratch');
    fs.writeFileSync(path.join(scratchDir, `uucms_result_${enbsId}.html`), res.data);
    
    return NextResponse.json({
      url,
      length: res.data.length,
      savedTo: `scratch/uucms_result_${enbsId}.html`,
      hasTable: res.data.includes('<table'),
      hasSubjects: res.data.includes('Course Code')
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
