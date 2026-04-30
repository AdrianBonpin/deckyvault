"use client";

import { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface SteamReview {
  recommendationid: string;
  author: {
    steamid: string;
    playtime_forever: number;
  };
  language: string;
  review: string;
  timestamp_created: number;
  voted_up: boolean;
  votes_up: number;
  votes_funny: number;
}

interface SteamReviewsData {
  success: number;
  query_summary: {
    num_reviews: number;
    review_score_desc: string;
    total_positive: number;
    total_negative: number;
    total_reviews: number;
  };
  reviews: SteamReview[];
}

interface SteamReviewsProps {
  gameId: string;
  steamAppId: number;
  className?: string;
}

export function SteamReviews({ gameId, steamAppId, className }: SteamReviewsProps) {
  const [data, setData] = useState<SteamReviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const fetchReviews = async (newOffset: number) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/steam-reviews/${gameId}?offset=${newOffset}&limit=5&language=english`
      );

      if (!res.ok) throw new Error("Failed to load reviews");

      const result = await res.json();
      setData(result);
      setOffset(newOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(0);
  }, [gameId]);

  if (loading && !data) {
    return (
      <div className={cn("animate-pulse space-y-4", className)}>
        <div className="h-8 w-48 rounded bg-zinc-800" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-zinc-800/50" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-zinc-800 p-4", className)}>
        <p className="text-sm text-zinc-400">Failed to load Steam reviews</p>
      </div>
    );
  }

  if (!data?.query_summary) return null;

  const { query_summary: summary } = data;
  const positivePercent =
    summary.total_reviews > 0
      ? Math.round((summary.total_positive / summary.total_reviews) * 100)
      : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Steam Reviews</h3>
          <p className="text-sm text-zinc-400">
            {summary.review_score_desc} — {positivePercent}% positive ({summary.total_reviews.toLocaleString()} reviews)
          </p>
        </div>
        <a
          href={`https://store.steampowered.com/app/${steamAppId}#app_reviews_hash`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
        >
          View on Steam <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Review cards */}
      <div className="space-y-3">
        {data.reviews.map((review) => (
          <div
            key={review.recommendationid}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {review.voted_up ? (
                  <ThumbsUp className="h-4 w-4 text-green-400" />
                ) : (
                  <ThumbsDown className="h-4 w-4 text-red-400" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  review.voted_up ? "text-green-400" : "text-red-400"
                )}>
                  {review.voted_up ? "Recommended" : "Not Recommended"}
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {Math.floor(review.author.playtime_forever / 60)}h played
              </span>
            </div>
            <p className="text-sm text-zinc-300 line-clamp-4">{review.review}</p>
            <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
              <span>{review.votes_up} found helpful</span>
              {review.votes_funny > 0 && (
                <span>{review.votes_funny} funny</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between">
        <button
          onClick={() => fetchReviews(Math.max(0, offset - 5))}
          disabled={offset === 0 || loading}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => fetchReviews(offset + 5)}
          disabled={loading}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
