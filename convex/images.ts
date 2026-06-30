import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getUserFromToken } from "./authHelper";

async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getCloudinaryConfig() {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (cloudinaryUrl) {
    const parsed = new URL(cloudinaryUrl);
    return {
      cloudName: parsed.hostname,
      apiKey: decodeURIComponent(parsed.username),
      apiSecret: decodeURIComponent(parsed.password),
    };
  }

  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };
}

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    if (!requester) {
      throw new Error("No autorizado");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const generateCloudinarySignature = mutation({
  args: {
    token: v.string(),
    folder: v.union(v.literal("profiles"), v.literal("teens")),
  },
  handler: async (ctx, args) => {
    const requester = await getUserFromToken(ctx, args.token);
    if (!requester) {
      throw new Error("No autorizado");
    }

    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Cloudinary no está configurado. Falta CLOUDINARY_URL o CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET.");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `faro-app/${args.folder}`;
    const signature = await sha1Hex(`folder=${folder}&timestamp=${timestamp}${apiSecret}`);

    return {
      cloudName,
      apiKey,
      timestamp,
      folder,
      signature,
    };
  },
});
