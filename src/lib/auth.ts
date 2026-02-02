import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

// Allowed GitHub usernames (for private access)
const ALLOWED_USERS = ['skadauke'];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // Only allow specific GitHub users
      const username = profile?.login as string;
      if (!ALLOWED_USERS.includes(username)) {
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
