import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import Google from 'next-auth/providers/google';
import PostgresAdapter from '@auth/pg-adapter';
import { Pool } from '@neondatabase/serverless';

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  return {
    adapter: PostgresAdapter(pool),
    providers: [
      Resend({ from: process.env.AUTH_EMAIL_FROM ?? 'Finpath <onboarding@resend.dev>' }),
      ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
        ? [
            Google({
              clientId: process.env.AUTH_GOOGLE_ID,
              clientSecret: process.env.AUTH_GOOGLE_SECRET,
              // Accepted policy: users may sign up via email magic-link then later use
              // Google OAuth (or vice versa). Auth.js blocks linking by default; this
              // flag allows it. Safe here because both providers verify email ownership.
              allowDangerousEmailAccountLinking: true,
            }),
          ]
        : []),
    ],
    pages: {
      signIn: '/auth/signin',
      verifyRequest: '/auth/verify',
    },
    callbacks: {
      session({ session, user }) {
        if (session.user && user) {
          session.user.id = user.id;
        }
        return session;
      },
    },
  };
});
