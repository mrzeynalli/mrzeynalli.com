import type { CollectionEntry } from "astro:content";
import projectFilter from "./projectFilter";

/** Manual `order` first (descending), then newest project first. */
const getSortedProjects = (projects: CollectionEntry<"projects">[]) =>
  projects
    .filter(projectFilter)
    .sort(
      (a, b) =>
        b.data.order - a.data.order ||
        b.data.startDate.getTime() - a.data.startDate.getTime()
    );

export default getSortedProjects;
