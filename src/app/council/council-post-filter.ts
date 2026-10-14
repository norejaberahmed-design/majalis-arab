export type CouncilPostFilter = "all" | "questions";

type FilterablePost = {
  content: string;
  author: { name: string };
};

export function isCouncilQuestion(content: string) {
  const normalized = content.trim();
  return content.includes("؟") || content.includes("?")
    || /^سؤال[:：\\s]/.test(normalized)
    || /^(هل|ما|ماذا|متى|أين|اين|كيف|لماذا|لِماذا|من|أي|أَيّ|كم|أيان)(?:[\\s،:：]|$)/.test(normalized);
}

export function filterCouncilPosts<T extends FilterablePost>(
  posts: T[],
  query: string,
  filter: CouncilPostFilter
): T[] {
  const normalized = query.trim().toLocaleLowerCase("ar");
  return posts.filter(post => {
    const matchesQuery = !normalized
      || post.content.toLocaleLowerCase("ar").includes(normalized)
      || post.author.name.toLocaleLowerCase("ar").includes(normalized);
    return matchesQuery && (filter === "all" || isCouncilQuestion(post.content));
  });
}
