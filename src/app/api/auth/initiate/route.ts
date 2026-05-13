import { NextResponse } from 'next/server';
import { initiateLogin } from '@/services/uucms/login';

export async function GET() {
  try {
    const data = await initiateLogin();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Initiate login error:', error);
    return NextResponse.json({ error: 'Failed to initiate login' }, { status: 500 });
  }
}
