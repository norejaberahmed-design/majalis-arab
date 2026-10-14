import { describe, expect, it } from "vitest";
import { filterCouncilPosts, isCouncilQuestion } from "./council-post-filter";

const posts = [
  { id: "1", content: "سؤال: أين المصدر؟", author: { name: "سالم" } },
  { id: "2", content: "هل توجد رواية أخرى", author: { name: "ناصر" } },
  { id: "3", content: "رحلة تاريخية موثقة", author: { name: "سالم العتيبي" } },
  { id: "4", content: "Question about the archive?", author: { name: "Mona" } }
];

describe("council post filtering", () => {
  it("recognizes Arabic question marks, ASCII question marks, and the سؤال prefix", () => {
    expect(isCouncilQuestion("ما المصدر؟")).toBe(true);
    expect(isCouncilQuestion("Is this verified?")).toBe(true);
    expect(isCouncilQuestion("  سؤال: ما المرجع")).toBe(true);
    expect(isCouncilQuestion("حديث بلا علامة")).toBe(false);
  });

  it("matches post content case-insensitively and trims the query", () => {
    expect(filterCouncilPosts(posts, "  رحلة ", "all").map(post => post.id)).toEqual(["3"]);
    expect(filterCouncilPosts(posts, "ARCHIVE", "all").map(post => post.id)).toEqual(["4"]);
  });

  it("matches the author's name as well as post content", () => {
    expect(filterCouncilPosts(posts, "سالم", "all").map(post => post.id)).toEqual(["1", "3"]);
  });

  it("keeps only questions when the questions filter is selected", () => {
    expect(filterCouncilPosts(posts, "", "questions").map(post => post.id)).toEqual(["1", "2", "4"]);
  });

  it("returns an empty result when nothing matches, allowing the empty state to render", () => {
    expect(filterCouncilPosts(posts, "قبيلة غير موجودة", "all")).toEqual([]);
    expect(filterCouncilPosts(posts, "قبيلة غير موجودة", "questions")).toEqual([]);
  });

  it("shows all posts when the query is empty and filter is all", () => {
    expect(filterCouncilPosts(posts, " ", "all")).toEqual(posts);
  });
});
