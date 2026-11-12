import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID || "not-configured", clientSecret: process.env.GOOGLE_CLIENT_SECRET || "not-configured" })],
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  callbacks: {
    async signIn({ profile }) { return Boolean(profile?.email && profile.email.toLowerCase() === process.env.OWNER_EMAIL?.toLowerCase()); },
    async session({ session }) { return session; },
  },
};
