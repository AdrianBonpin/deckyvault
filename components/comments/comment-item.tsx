"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import {
  ThumbsUpIcon,
  ReplyIcon,
  MoreHorizontalIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react"
import { useSession } from "@/lib/auth-client"
import { TiptapRenderer } from "@/components/tiptap-renderer"
import { TiptapEditor } from "@/components/tiptap-editor"

export interface CommentData {
  id: string
  gameId: string
  userId: string
  parentId: string | null
  content: Record<string, unknown>
  upvotes: number
  createdAt: string
  updatedAt: string
  userName: string | null
  userImage: string | null
}

function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getInitial(name: string | null | undefined): string {
  return name?.charAt(0)?.toUpperCase() || "?"
}

const MAX_DEPTH = 3

interface CommentItemProps {
  comment: CommentData
  depth?: number
  onReplyPosted: () => void
  gameId: string
}

export function CommentItem({
  comment,
  depth = 0,
  onReplyPosted,
  gameId,
}: CommentItemProps) {
  const { data: session } = useSession()
  const [upvotes, setUpvotes] = useState(comment.upvotes)
  const [hasUpvoted, setHasUpvoted] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  const [replyContent, setReplyContent] = useState<Record<string, unknown> | null>(null)
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [replies, setReplies] = useState<CommentData[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDeleted, setIsDeleted] = useState(false)

  const isOwner = session?.user?.id === comment.userId
  const isAdmin = session?.user?.role === "admin"
  const canModerate = isOwner || isAdmin

  const handleUpvote = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetch(
        `/api/games/${gameId}/comments/${comment.id}/upvote`,
        { method: "POST" },
      )
      if (res.ok) {
        setUpvotes((prev) => (hasUpvoted ? prev - 1 : prev + 1))
        setHasUpvoted((prev) => !prev)
      }
    } catch (err) {
      console.error("Failed to upvote comment:", err)
    }
  }, [session, gameId, comment.id, hasUpvoted])

  const handleReplySubmit = useCallback(async () => {
    if (!replyContent || !session) return
    setReplySubmitting(true)
    try {
      const res = await fetch(`/api/games/${gameId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: comment.id, content: replyContent }),
      })
      if (res.ok) {
        setIsReplying(false)
        setReplyContent(null)
        onReplyPosted()
        if (showReplies) {
          // Refresh replies
          setLoadingReplies(true)
          const repliesRes = await fetch(
            `/api/games/${gameId}/comments/${comment.id}/replies`,
          )
          if (repliesRes.ok) {
            const data = (await repliesRes.json()) as CommentData[]
            setReplies(data)
          }
          setLoadingReplies(false)
        }
      }
    } catch (err) {
      console.error("Failed to post reply:", err)
    } finally {
      setReplySubmitting(false)
    }
  }, [replyContent, session, gameId, comment.id, onReplyPosted, showReplies])

  const handleDelete = useCallback(async () => {
    if (!canModerate) return
    try {
      const res = await fetch(
        `/api/games/${gameId}/comments/${comment.id}`,
        { method: "DELETE" },
      )
      if (res.ok) {
        setIsDeleted(true)
      }
    } catch (err) {
      console.error("Failed to delete comment:", err)
    }
  }, [canModerate, gameId, comment.id])

  const handleLoadReplies = useCallback(async () => {
    if (showReplies) {
      setShowReplies(false)
      return
    }
    setLoadingReplies(true)
    try {
      const res = await fetch(
        `/api/games/${gameId}/comments/${comment.id}/replies`,
      )
      if (res.ok) {
        const data = (await res.json()) as CommentData[]
        setReplies(data)
        setShowReplies(true)
      }
    } catch (err) {
      console.error("Failed to load replies:", err)
    } finally {
      setLoadingReplies(false)
    }
  }, [showReplies, gameId, comment.id])

  if (isDeleted) {
    return (
      <div className="py-3 text-sm text-text/40 italic">
        Comment removed
      </div>
    )
  }

  return (
    <div className={depth > 0 ? "ml-4 border-l border-border pl-3" : ""}>
      <div className="flex gap-3 py-3">
        {/* Avatar */}
        <div className="shrink-0">
          {comment.userImage ? (
            <Image
              src={comment.userImage}
              alt={comment.userName || "User"}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-text/10 flex items-center justify-center text-sm font-medium text-text/70">
              {getInitial(comment.userName)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text">
              {comment.userName || "Unknown"}
            </span>
            <span className="text-xs text-text/40">
              {formatDate(comment.createdAt)}
            </span>
          </div>

          <div className="mt-1">
            <TiptapRenderer content={JSON.stringify(comment.content)} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={handleUpvote}
              className={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${
                hasUpvoted
                  ? "text-primary"
                  : "text-text/50 hover:text-text/80"
              }`}
              title="Upvote"
            >
              <ThumbsUpIcon className="h-3.5 w-3.5" />
              <span>{upvotes}</span>
            </button>

            {session && depth < MAX_DEPTH && (
              <button
                onClick={() => setIsReplying((prev) => !prev)}
                className="flex items-center gap-1 text-xs text-text/50 hover:text-text/80 transition-colors cursor-pointer"
                title="Reply"
              >
                <ReplyIcon className="h-3.5 w-3.5" />
                <span>Reply</span>
              </button>
            )}

            {canModerate && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex items-center gap-1 text-xs text-text/50 hover:text-text/80 transition-colors cursor-pointer"
                  title="More options"
                >
                  <MoreHorizontalIcon className="h-3.5 w-3.5" />
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-1 w-32 rounded-md border border-border bg-background shadow-lg overflow-hidden">
                      <button
                        onClick={() => {
                          setMenuOpen(false)
                          handleDelete()
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Reply form */}
          {isReplying && (
            <div className="mt-3 flex flex-col gap-2">
              <TiptapEditor
                placeholder="Write a reply..."
                onChange={(json) => setReplyContent(json)}
                className="min-h-[100px]"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReplySubmit}
                  disabled={!replyContent || replySubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {replySubmitting ? "Posting..." : "Post Reply"}
                </button>
                <button
                  onClick={() => {
                    setIsReplying(false)
                    setReplyContent(null)
                  }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text/70 hover:bg-text/10 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Load replies */}
          {depth < MAX_DEPTH && (
            <div className="mt-2">
              {replies.length > 0 && !showReplies && (
                <button
                  onClick={() => setShowReplies(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                  Show {replies.length} replies
                </button>
              )}
              {showReplies && replies.length > 0 && (
                <button
                  onClick={() => setShowReplies(false)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  <ChevronUpIcon className="h-3.5 w-3.5" />
                  Hide replies
                </button>
              )}
              {replies.length === 0 && !showReplies && (
                <button
                  onClick={handleLoadReplies}
                  disabled={loadingReplies}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loadingReplies ? (
                    "Loading..."
                  ) : (
                    <>
                      <ChevronDownIcon className="h-3.5 w-3.5" />
                      Load replies
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Replies list */}
          {depth < MAX_DEPTH && showReplies && replies.length > 0 && (
            <div className="mt-2">
              {replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                  onReplyPosted={onReplyPosted}
                  gameId={gameId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
