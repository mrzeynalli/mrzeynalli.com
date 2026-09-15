import type { CollectionEntry } from "astro:content";
import { SITE } from "@/config";

/**
 * Drafts and not-yet-scheduled posts are visible while running `astro dev`,
 * hidden in production builds. Matches `projectFilter` for the projects
 * collection.
 */
const postFilter = ({ data }: CollectionEntry<"blog">) => {
  if (import.meta.env.DEV) return true;

  const isPublishTimePassed =
    Date.now() >
    new Date(data.pubDatetime).getTime() - SITE.scheduledPostMargin;

  return !data.draft && isPublishTimePassed;
};

export default postFilter;
