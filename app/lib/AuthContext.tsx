"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "./supabase"
import { Session, User } from "@supabase/supabase-js"

interface Profile {
    id: string
    email: string | null
    role: "admin" | "sales"
}

interface AuthContextType {
    user: User | null
    session: Session | null
    profile: Profile | null
    loading: boolean
    signOut: () => Promise<void>
    mockLogin: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check for mock session first
        const savedMock = localStorage.getItem("mock_user")
        if (savedMock) {
            const data = JSON.parse(savedMock)
            setUser(data.user)
            setProfile(data.profile)
            setLoading(false)
            return
        }

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) fetchProfile(session.user.id)
            else setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            setSession(session)
            setUser(session?.user ?? null)
            if (session?.user) await fetchProfile(session.user.id)
            else {
                setProfile(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    async function mockLogin(email: string) {
        const mockUser: any = { id: "mock-admin-id", email: email }
        const mockProfile: Profile = { id: "mock-admin-id", email: email, role: "admin" }

        setUser(mockUser)
        setProfile(mockProfile)
        localStorage.setItem("mock_user", JSON.stringify({ user: mockUser, profile: mockProfile }))
        setLoading(false)
    }

    async function fetchProfile(uid: string) {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", uid)
                .single()

            if (error) {
                console.error("Error fetching profile:", error)
                setProfile(null)
            } else {
                setProfile(data as Profile)
            }
        } finally {
            setLoading(false)
        }
    }

    const signOut = async () => {
        localStorage.removeItem("mock_user")
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        setProfile(null)
    }

    return (
        <AuthContext.Provider value={{ user, session, profile, loading, signOut, mockLogin }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider")
    }
    return context
}
