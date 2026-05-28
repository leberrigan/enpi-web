import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? '');
const COOKIE = 'enpi-session';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(COOKIE);
    return response;
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/device/:path*'],
};
