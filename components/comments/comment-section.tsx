"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { MessageSquareIcon, Loader2 } from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { TiptapEditor } from "@/components/tiptap-editor"
import { CommentItem, CommentData } from "./comment-item"

interface CommentSectionProps {
  gameId: string
  initialCount: number
}

interface CommentsApiResponse {
  data: CommentData[]
  total: number
  limit: number
  offset: number
}

export function CommentSection({ gameId, initialCount }: CommentSectionProps) {
  const { data: session } = useSession()
  const [comments, setComments] = useState<CommentData[]>([])
  const [total, setTotal] = useState(initialCount)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [commentContent, setCommentContent] = useState<Record<string, unknown> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const limit = 20

  // Initial load
  useEffect(() => {
    let cancelled = false
    async function fetchInitial() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/games/${gameId}/comments?limit=${limit}&offset=0`,
        )
        if (!cancelled && res.ok) {
          const json = (await res.json()) as CommentsApiResponse
          setComments(json.data)
          setTotal(json.total)
        }
      } catch (err) {
        console.error("Failed to load comments:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchInitial()
    return () => {
      cancelled = true
    }
  }, [gameId])

  const refreshComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/games/${gameId}/comments?limit=${limit}&offset=0`,
      )
      if (res.ok) {
        const json = (await res.json()) as CommentsApiResponse
        setComments(json.data)
        setTotal(json.total)
      }
    } catch (err) {
      console.error("Failed to refresh comments:", err)
    }
  }, [gameId])

  const handleSubmit = useCallback(async () => {
    if (!commentContent || !session) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/games/${gameId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentContent }),
      })
      if (res.ok) {
        setCommentContent(null)
        await refreshComments()
      }
    } catch (err) {
      console.error("Failed to post comment:", err)
    } finally {
      setSubmitting(false)
    }
  }, [commentContent, session, gameId, refreshComments])

  const handleLoadMore = useCallback(async () => {
    const newOffset = offset + limit
    setLoading(true)
    try {
      const res = await fetch(
        `/api/games/${gameId}/comments?limit=${limit}&offset=${newOffset}`,
      )
      if (res.ok) {
        const json = (await res.json()) as CommentsApiResponse
        setComments((prev) => [...prev, ...json.data])
        setTotal(json.total)
        setOffset(newOffset)
      }
    } catch (err) {
      console.error("Failed to load more comments:", err)
    } finally {
      setLoading(false)
    }
  }, [offset, gameId])

  const handleReplyPosted = useCallback(() => {
    refreshComments()
  }, [refreshComments])

  const hasMore = comments.length < total

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquareIcon className="h-5 w-5 text-text/70" />
        <h2 className="text-lg font-semibold text-text">Comments</h2>
        <span className="text-sm text-text/50">({total})</span>
      </div>

      {/* Compose */}
      {session ? (
        <div className="flex flex-col gap-2">
          <TiptapEditor
            placeholder="Leave a comment..."
            onChange={(json) => setCommentContent(json)}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!commentContent || submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                "Post Comment"
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-border bg-text/3 text-center">
          <p className="text-sm text-text/70">
            <Link
              href="/auth/sign-in"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Sign in
            </Link>{" "}
            to leave a comment
          </p>
        </div>
      )}

      {/* Comment list */}
      <div className="flex flex-col">
        {loading && comments.length === 0 ? (
          <div className="py-8 text-center text-sm text-text/50">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center text-sm text-text/50">
            No comments yet. Be the first to share your thoughts!
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              onReplyPosted={handleReplyPosted}
              gameId={gameId}
            />
          ))
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-text/5 text-text/70 hover:bg-text/10 transition-colors cursor-pointer"
          >
            Load more comments
          </button>
        </div>
      )}

      {loading && comments.length > 0 && (
        <div className="py-4 text-center text-sm text-text/50">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </div>
      )}
    </div>
  )
}
