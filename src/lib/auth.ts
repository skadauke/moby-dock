import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

// Allowed GitHub usernames (for private access)
const ALLOWED_USERS = ['skadauke'];

// Get GitHub OAuth credentials (validated at runtime during auth)
const GITHUB_ID = process.env.GITHUB_ID ?? '';
const GITHUB_SECRET = process.env.GITHUB_SECRET ?? '';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: GITHUB_ID,
      clientSecret: GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // Only allow specific GitHub users
      const username = profile?.login;
      if (typeof username !== 'string' || !ALLOWED_USERS.includes(username)) {
        return false;
      }
      return true;
    },
    async session({ session, token }) {
      // Add GitHub username to session
      if (token.sub) {
        session.user.id = token.sub;
      }
      if (token.username) {
        session.user.username = token.username as string;
      }
      return session;
    },
    async jwt({ token, profile }) {
      if (profile) {
        token.username = profile.login;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
});
