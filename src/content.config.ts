import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { SITE } from "@/config";

export const BLOG_PATH = "src/data/blog";
export const PROJECTS_PATH = "src/data/projects";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
      category: z.enum(["Analytics", "Quant Research", "Automation"]).optional(),
    }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${PROJECTS_PATH}` }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      tagline: z.string(),
      description: z.string(),
      // "live" = publicly reachable, "wip" = running but not exposed, "archived" = no longer maintained
      status: z.enum(["live", "wip", "archived"]).default("wip"),
      startDate: z.date(),
      stack: z.array(z.string()).default([]),
      liveUrl: z.string().url().optional(),
      repoUrl: z.string().url().optional(),
      screenshot: image().optional(),
      featured: z.boolean().default(false),
      order: z.number().default(0),
      draft: z.boolean().optional(),
      // slug of a blog post in the `blog` collection that writes this project up
      relatedPosts: z.array(z.string()).default([]),
    }),
});

export const collections = { blog, projects };
