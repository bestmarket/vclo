export type DiscoveredVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail?: string;
  views?: number;
  publishedAt?: string;
};

export async function discoverVideos(link: string, limit = 20): Promise<DiscoveredVideo[]> {
  const res = await fetch("/api/youtube/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ link, limit }),
  });
  const data = await res.json();
  if (!res.ok || !data.videos) {
    throw new Error(data.error || "That doesn't look like a YouTube channel or video link.");
  }
  return data.videos;
}

export async function fetchTranscript(videoId: string): Promise<{
  text: string;
  source: string;
  title?: string;
}> {
  const res = await fetch("/api/youtube/transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });
  const data = await res.json();
  if (!res.ok || !data.text) {
    throw new Error(data.error || "This video has no captions and no description to read.");
  }
  return {
    text: data.text,
    source: data.source,
    title: data.title,
  };
}
