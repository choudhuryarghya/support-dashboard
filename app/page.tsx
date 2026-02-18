"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { supabase } from "./lib/supabase"
import Image from "next/image"

export default function Dashboard() {

  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  /* ===============================
     FETCH CONVERSATIONS
  =============================== */

  async function fetchConversations() {
    const { data, error } = await supabase
      .from("messages")
      .select("conversation_id, created_at")
      .not("conversation_id", "is", null)
      .order("created_at", { ascending: false })

    if (error) return

    // Remove duplicates
    const unique = Array.from(
      new Map(
        data.map((item: any) => [item.conversation_id, item])
      ).values()
    )

    setConversations(unique)
  }

  useEffect(() => {
    fetchConversations()
  }, [])

  /* ===============================
     FETCH MESSAGES
  =============================== */

  async function fetchMessages(conversationId: string) {
    setSelectedConversation(conversationId)

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .not("conversation_id", "is", null)
      .order("created_at", { ascending: true })

    if (error) return

    setMessages(data || [])
  }

  /* ===============================
     REALTIME SUBSCRIPTION
  =============================== */

  useEffect(() => {
    if (!selectedConversation) return

    const channel = supabase
      .channel(`conversation-${selectedConversation}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversation}`
        },
        (payload) => {
          setMessages((prev) => {
            // prevent duplicates
            if (prev.find((m) => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })

          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConversation])

  /* ===============================
     AUTO SCROLL
  =============================== */

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  /* ===============================
     SEARCH FILTER
  =============================== */

  const filteredConversations = useMemo(() => {
    return conversations.filter((conv) =>
      conv.conversation_id
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
  }, [searchTerm, conversations])

  /* ===============================
     UI
  =============================== */

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 to-indigo-100">

      {/* SIDEBAR */}
      <div className="w-1/4 bg-white shadow-xl p-5 flex flex-col border-r">

        {/* LOGO */}
        <div className="flex items-center gap-3 mb-6">
          <Image
            src="/frostreklogo.png"
            alt="Frostrek Logo"
            width={45}
            height={45}
            className="rounded-lg"
          />
          <div>
            <h1 className="text-xl font-bold text-indigo-600">
              Frostrek LLP
            </h1>
            <p className="text-xs text-gray-400">
              Support Dashboard
            </p>
          </div>
        </div>

        {/* SEARCH */}
        <input
          type="text"
          placeholder="Search conversation..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="mb-4 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-400"
        />

        {/* CONVERSATIONS */}
        <div className="overflow-y-auto flex-1 pr-1">
          {filteredConversations.map((conv) => (
            <div
              key={conv.conversation_id}
              onClick={() => fetchMessages(conv.conversation_id)}
              className={`p-3 mb-3 rounded-xl cursor-pointer transition 
                ${selectedConversation === conv.conversation_id
                  ? "bg-indigo-100 shadow"
                  : "bg-gray-50 hover:bg-indigo-50"}`}
            >
              <p className="font-semibold text-gray-700">
                {conv.conversation_id.substring(0, 8)}...
              </p>

              <p className="text-xs text-gray-400">
                {new Date(conv.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="w-3/4 flex flex-col p-6">

        {selectedConversation ? (
          <>
            <h2 className="font-semibold text-lg mb-4 text-indigo-700">
              Conversation: {selectedConversation}
            </h2>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-lg px-4 py-3 rounded-2xl shadow-md transition
                    ${msg.role === "user"
                      ? "ml-auto bg-indigo-500 text-white"
                      : "bg-white text-gray-800 border"}`}
                >
                  <p className="text-sm">
                    {msg.messages || msg.processed_content || ""}
                  </p>

                  <span className="text-xs opacity-70 block mt-1 text-right">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))}

              <div ref={chatEndRef} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Select a conversation to view chat
          </div>
        )}
      </div>
    </div>
  )
}
