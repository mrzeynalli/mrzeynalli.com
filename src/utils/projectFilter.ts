import type { CollectionEntry } from "astro:content";

/** Drafts are visible while running `astro dev`, hidden in production builds. */
const projectFilter = ({ data }: CollectionEntry<"projects">) =>
  !data.draft || import.meta.env.DEV;

export default projectFilter;
