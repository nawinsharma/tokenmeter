"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin: baseURL is inferred from the browser location, so no config needed.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
