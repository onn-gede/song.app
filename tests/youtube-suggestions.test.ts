import test from "node:test";
import assert from "node:assert/strict";
import { isYouthCollection, parseYouTubeSearchItems, youtubeSearchUrl } from "../lib/youtube-suggestions";

test("YouTube suggestions are scoped to the youth collection", () => {
  assert.equal(isYouthCollection({ name: "Cântări tineri - BCB Giroc", short_code: "TINERI" }), true);
  assert.equal(isYouthCollection({ name: "Cartea roșie", short_code: "CR" }), false);
  assert.match(youtubeSearchUrl("Harul Tău"), /youtube\.com\/results\?search_query=/);
});

test("YouTube API search results are reduced to safe video links", () => {
  const results = parseYouTubeSearchItems({
    items: [
      {
        id: { videoId: "abcDEF_1234" },
        snippet: {
          title: "Cântare",
          channelTitle: "Canal",
          thumbnails: { default: { url: "https://img.example/x.jpg" } },
        },
      },
      { id: { channelId: "bad" }, snippet: { title: "Canal" } },
    ],
  });
  assert.deepEqual(results, [
    {
      videoId: "abcDEF_1234",
      title: "Cântare",
      channel: "Canal",
      thumbnail: "https://img.example/x.jpg",
      url: "https://www.youtube.com/watch?v=abcDEF_1234",
    },
  ]);
});
