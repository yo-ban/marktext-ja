// Unicode-aware, matching GitHub's own slugger: letters, marks and numbers in
// any script survive (a Japanese heading keeps its text as the anchor), while
// punctuation is stripped. The previous ASCII `\w` variant reduced an
// all-CJK heading to an empty slug, breaking every TOC link to it.
export function generateGithubSlug(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}
