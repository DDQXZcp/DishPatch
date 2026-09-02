import { createContext, useContext, useState, ReactNode } from "react";

export const GUEST_USER = "92e4933e-0a94-40d7-80f1-6a8d15d357f9";

interface AuthContextType {
    userId: string;
    isGuest: boolean;
    login: (userId: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [userId, setUserId] = useState<string>(
        () => localStorage.getItem("userId") || GUEST_USER
    );

    const login = (id: string) => {
        localStorage.setItem("userId", id);
        setUserId(id);
    };

    const logout = () => {
        localStorage.removeItem("userId");
        setUserId(GUEST_USER);
    };

    return (
        <AuthContext.Provider value={{ userId, isGuest: userId === GUEST_USER, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}